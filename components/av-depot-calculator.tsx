"use client"

import { useId, useRef, useState, useTransition } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeEuro,
  Baby,
  ChartColumnIncreasing,
  CircleHelp,
  Landmark,
  LoaderCircle,
  Plus,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CALCULATION_START_YEAR,
  ETF_PARTIAL_EXEMPTION,
  ETF_TAX_RATE,
  ETF_VORABPAUSCHALE_BASIS_RATE,
  RETIREMENT_AGE,
  type AdultContractCount,
  type CalculatorInputs,
  type ChildProfile,
  type OptimizationResult,
  clampInputs,
  compareStrategies,
  getEligibleChildrenForYear,
  optimizeAvAllocation,
} from "@/lib/retirement-model"

const DEFAULT_INPUTS: CalculatorInputs = {
  etfFeePercent: 0.2,
  avFeePercent: 0.6,
  totalMonthlySavings: 1000,
  monthlyAvContribution: 300,
  adultCount: 1,
  contractCount: 1,
  partnerAContractCount: 1,
  partnerBContractCount: 1,
  childBenefitRecipient: 1,
  annualReturnPercent: 7,
  startingEtfBalance: 25000,
  partnerAAge: 35,
  partnerBAge: 33,
  children: [],
}

export function AvDepotCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS)
  const [optimization, setOptimization] = useState<OptimizationResult | null>(
    null
  )
  const [isOptimizing, startOptimizationTransition] = useTransition()
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const result = compareStrategies(inputs)
  const normalizedInputs = result.normalizedInputs
  const splitScenario = result.splitScenario
  const etfOnlyScenario = result.etfOnlyScenario
  const currentJson = JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      calculator: "av-depot-rechner",
      inputs: normalizedInputs,
    },
    null,
    2
  )

  const splitDelta = splitScenario.totalBalance - etfOnlyScenario.totalBalance
  const avShare = normalizedInputs.monthlyAvContribution
  const etfShare = normalizedInputs.totalMonthlySavings - avShare
  const activeEligibleChildren = getEligibleChildrenForYear(
    normalizedInputs.children,
    0
  )
  const avContributionSliderMax = Math.min(
    result.maxMonthlyAvContribution,
    normalizedInputs.totalMonthlySavings
  )

  function updateInput<K extends keyof CalculatorInputs>(
    key: K,
    value: CalculatorInputs[K]
  ) {
    setInputs((previous) => clampInputs({ ...previous, [key]: value }))
    setOptimization(null)
  }

  function updateAdultCount(nextAdultCount: 1 | 2) {
    setInputs((previous) =>
      clampInputs({
        ...previous,
        adultCount: nextAdultCount,
        partnerBContractCount:
          nextAdultCount === 2
            ? previous.partnerBContractCount === 0
              ? 1
              : previous.partnerBContractCount
            : previous.partnerBContractCount,
      })
    )
    setOptimization(null)
  }

  function updatePartnerContractCount(
    partner: 1 | 2,
    contractCount: AdultContractCount
  ) {
    updateInput(
      partner === 1 ? "partnerAContractCount" : "partnerBContractCount",
      contractCount as CalculatorInputs["partnerAContractCount"]
    )
  }

  function exportJson() {
    const blob = new Blob([currentJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "av-depot-szenario.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleJsonImport(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const [file] = event.target.files ?? []

    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const migratedChildren = Array.isArray(parsed?.inputs?.children)
          ? parsed.inputs.children
          : Array.isArray(parsed?.children)
            ? parsed.children
            : Array.from(
                {
                  length: Number(parsed?.inputs?.eligibleChildren ?? parsed?.eligibleChildren ?? 0),
                },
                () => ({
                  currentAge: 0,
                  eligibleUntilAge: 18,
                })
              )
        const nextInputs = clampInputs({
          ...DEFAULT_INPUTS,
          ...(parsed?.inputs ?? parsed),
          partnerAAge:
            parsed?.inputs?.partnerAAge ??
            parsed?.partnerAAge ??
            parsed?.inputs?.age ??
            parsed?.age ??
            DEFAULT_INPUTS.partnerAAge,
          partnerBAge:
            parsed?.inputs?.partnerBAge ??
            parsed?.partnerBAge ??
            DEFAULT_INPUTS.partnerBAge,
          children: migratedChildren,
        })
        setInputs(nextInputs)
        setOptimization(null)
      } catch {
        window.alert("Die JSON-Datei konnte nicht geladen werden.")
      } finally {
        event.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  function addChild() {
    updateInput("children", [
      ...normalizedInputs.children,
      { currentAge: 0, eligibleUntilAge: 18 },
    ])
  }

  function updateChild(index: number, patch: Partial<ChildProfile>) {
    updateInput(
      "children",
      normalizedInputs.children.map((child, childIndex) =>
        childIndex === index ? { ...child, ...patch } : child
      )
    )
  }

  function removeChild(index: number) {
    updateInput(
      "children",
      normalizedInputs.children.filter((_, childIndex) => childIndex !== index)
    )
  }

  function runOptimization() {
    startOptimizationTransition(() => {
      setOptimization(optimizeAvAllocation(normalizedInputs))
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(28,125,102,0.14),_transparent_35%),linear-gradient(180deg,_#f9f4e8_0%,_#fbfaf7_38%,_#f4efe1_100%)] px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border border-white/70 bg-white/85 shadow-[0_18px_80px_rgba(39,70,57,0.08)] backdrop-blur">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                  Rechnerstart {CALCULATION_START_YEAR}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-white/60 text-foreground"
                >
                  ETF vs. AV-Depot
                </Badge>
              </div>
              <CardTitle className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                AV-Depot-Rechner fur den Vergleich mit deinem heutigen ETF-Depot
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7 text-muted-foreground">
                Der Rechner startet mit der Sparphase ab dem{" "}
                <span className="font-medium text-foreground">
                  1. Januar {CALCULATION_START_YEAR}
                </span>
                , vergleicht ein geteiltes Szenario mit einem reinen ETF-Sparplan
                und berucksichtigt die{" "}
                <span className="font-medium text-foreground">
                  ETF-Vorabpauschale
                </span>{" "}
                sowie die{" "}
                <span className="font-medium text-foreground">
                  AV-Zulage inklusive Kinderkomponente
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickFact
                icon={ShieldCheck}
                title="AV-Vorabpauschale"
                value="nein"
                description="Im Modell fur das zertifizierte AV-Depot nicht angesetzt."
              />
              <QuickFact
                icon={BadgeEuro}
                title="Max. AV-Sparanteil"
                value={formatCurrency(result.maxMonthlyAvContribution)}
                description={`${result.totalAvContracts} aktiv${result.totalAvContracts === 1 ? "es" : "e"} AV-Depot${result.totalAvContracts === 1 ? "" : "s"} im manuellen Szenario`}
              />
              <QuickFact
                icon={Baby}
                title="Kinder jetzt aktiv"
                value={`${activeEligibleChildren} von ${normalizedInputs.children.length}`}
                description="Aktuell kindergeldberechtigte Kinder im Modell."
              />
              <QuickFact
                icon={PiggyBank}
                title="Haushaltshorizont"
                value={`${result.householdYearsToRetirement} Jahre`}
                description={`bis ${RETIREMENT_AGE} des jungeren Partners`}
              />
            </CardContent>
          </Card>

          <Card className="border border-primary/15 bg-[#173c35] text-white shadow-[0_24px_72px_rgba(12,34,30,0.26)]">
            <CardHeader>
              <CardTitle className="text-2xl">Szenario auf einen Blick</CardTitle>
              <CardDescription className="text-white/72">
                Eingestellte Sparrate ab {CALCULATION_START_YEAR} und die daraus
                abgeleitete Aufteilung.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryStat
                  label="Monatlich gesamt"
                  value={formatCurrency(normalizedInputs.totalMonthlySavings)}
                />
                <SummaryStat
                  label="Davon ins AV-Depot"
                  value={formatCurrency(avShare)}
                />
                <SummaryStat
                  label="Davon in ETF"
                  value={formatCurrency(etfShare)}
                />
                <SummaryStat
                  label="Startwert ETF"
                  value={formatCurrency(normalizedInputs.startingEtfBalance)}
                />
              </div>
              <Separator className="bg-white/15" />
              <div className="flex items-center justify-between gap-4 rounded-xl bg-white/7 px-4 py-3">
                <div>
                  <p className="text-sm text-white/68">Vorteil gguber Alles-ETF</p>
                  <p className="text-xl font-semibold">
                    {formatSignedCurrency(splitDelta)}
                  </p>
                </div>
                <Badge
                  className={
                    splitDelta >= 0
                      ? "bg-[#d9f4dd] text-[#0f5132]"
                      : "bg-[#fee2e2] text-[#7f1d1d]"
                  }
                >
                  {splitDelta >= 0 ? "AV-Szenario vorn" : "ETF-only vorn"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="border border-white/70 bg-white/88 shadow-[0_18px_80px_rgba(39,70,57,0.08)] backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">Regler</CardTitle>
              <CardDescription>
                Alle Werte sind Jahreskosten oder monatliche Sparraten. Der
                AV-Anteil wird automatisch an die gesetzliche Obergrenze angepasst.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SliderField
                label="ETF-Kosten p.a."
                description="Gesamtkostenquote des bisherigen ETF-Sparplans."
                valueLabel={formatPercent(normalizedInputs.etfFeePercent)}
                min={0}
                max={2}
                step={0.01}
                value={normalizedInputs.etfFeePercent}
                onChange={(value) => updateInput("etfFeePercent", value)}
              />
              <SliderField
                label="AV-Depot-Kosten p.a."
                description="Jahrliche Kosten fur das neue AV-Depot."
                valueLabel={formatPercent(normalizedInputs.avFeePercent)}
                min={0}
                max={2}
                step={0.01}
                value={normalizedInputs.avFeePercent}
                onChange={(value) => updateInput("avFeePercent", value)}
              />
              <SliderField
                label="Gesamte Sparsumme"
                description="Monatliche Gesamt-Sparrate, die du verteilen willst."
                valueLabel={formatCurrency(normalizedInputs.totalMonthlySavings)}
                min={0}
                max={3000}
                step={25}
                value={normalizedInputs.totalMonthlySavings}
                onChange={(value) => updateInput("totalMonthlySavings", value)}
              />
              <SliderField
                label="Davon ins AV-Depot"
                description={`Gesetzlich gedeckelt auf ${formatCurrency(result.maxMonthlyAvContribution)} pro Monat (${formatCurrency(result.maxAnnualAvContribution)} p.a.).`}
                valueLabel={formatCurrency(normalizedInputs.monthlyAvContribution)}
                min={0}
                max={avContributionSliderMax}
                step={10}
                value={normalizedInputs.monthlyAvContribution}
                onChange={(value) => updateInput("monthlyAvContribution", value)}
              />

              <div className="rounded-2xl border border-border/80 bg-muted/35 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">AV-Sparer in der Familie</p>
                      <Tooltip>
                        <TooltipTrigger className="rounded-full text-muted-foreground">
                          <CircleHelp className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Im Familienmodus wird unterstellt, dass ein oder zwei
                          Partner jeweils eigene foerderfaehige AV-Vertraege besparen.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Jeder Partner kann im Modell eigene AV-Depots mit eigener
                      Zulagefahigkeit haben.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">1</span>
                    <Switch
                      checked={normalizedInputs.adultCount === 2}
                      onCheckedChange={(checked) => updateAdultCount(checked ? 2 : 1)}
                    />
                    <span className="text-sm font-medium">2</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/35 px-4 py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Partner-Einstellungen</p>
                    <Tooltip>
                      <TooltipTrigger className="rounded-full text-muted-foreground">
                        <CircleHelp className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Pro Partner sind im manuellen Szenario `0`, `1` oder `2`
                        AV-Depots moeglich. Die Optimierung durchsucht diese
                        Kombinationen ebenfalls.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Lege Alter und AV-Depots je Partner direkt fest. `0` bedeutet:
                    kein AV-Depot fuer diesen Partner im eingestellten Szenario.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/80 bg-background/70 p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Partner 1</p>
                        <p className="text-sm text-muted-foreground">
                          Eigene Laufzeit und eigenes AV-Setup.
                        </p>
                      </div>
                      <ContractCountSelector
                        value={normalizedInputs.partnerAContractCount}
                        onChange={(value) => updatePartnerContractCount(1, value)}
                      />
                    </div>
                    <SliderField
                      label="Alter Partner 1"
                      description="Laufzeit fur Partner 1 bis 67."
                      valueLabel={`${normalizedInputs.partnerAAge} Jahre`}
                      min={18}
                      max={67}
                      step={1}
                      value={normalizedInputs.partnerAAge}
                      onChange={(value) =>
                        updateInput("partnerAAge", Math.round(value))
                      }
                    />
                  </div>

                  {normalizedInputs.adultCount === 2 ? (
                    <div className="rounded-xl border border-border/80 bg-background/70 p-4">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Partner 2</p>
                          <p className="text-sm text-muted-foreground">
                            Separat konfigurierbar, auch komplett ohne AV-Depot.
                          </p>
                        </div>
                        <ContractCountSelector
                          value={normalizedInputs.partnerBContractCount}
                          onChange={(value) => updatePartnerContractCount(2, value)}
                        />
                      </div>
                      <SliderField
                        label="Alter Partner 2"
                        description="Laufzeit fur Partner 2 bis 67."
                        valueLabel={`${normalizedInputs.partnerBAge} Jahre`}
                        min={18}
                        max={67}
                        step={1}
                        value={normalizedInputs.partnerBAge}
                        onChange={(value) =>
                          updateInput("partnerBAge", Math.round(value))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <SliderField
                label="Rendite p.a."
                description="Vor Kosten und vor ETF-Vorabpauschale."
                valueLabel={formatPercent(normalizedInputs.annualReturnPercent)}
                min={0}
                max={12}
                step={0.1}
                value={normalizedInputs.annualReturnPercent}
                onChange={(value) => updateInput("annualReturnPercent", value)}
              />
              <SliderField
                label="Startsumme ETF"
                description="Aktueller Depotstand, der weiter lauft."
                valueLabel={formatCurrency(normalizedInputs.startingEtfBalance)}
                min={0}
                max={250000}
                step={1000}
                value={normalizedInputs.startingEtfBalance}
                onChange={(value) => updateInput("startingEtfBalance", value)}
              />
              <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/35 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Kinder im Modell</p>
                      <Tooltip>
                        <TooltipTrigger className="rounded-full text-muted-foreground">
                          <CircleHelp className="size-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Die Kinderzulage lauft pro Kind nur solange, wie im
                          Modell Kindergeldberechtigung unterstellt wird. Standard
                          ist 18 Jahre, bei Ausbildung/Studium kannst du bis 25
                          anheben.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Lege fur jedes Kind das aktuelle Alter und das angenommene
                      Ende der Kindergeldberechtigung fest.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {normalizedInputs.adultCount === 2 ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 px-3 py-2">
                        <span className="text-sm text-muted-foreground">
                          Kinderzulage an
                        </span>
                        <Button
                          variant={
                            normalizedInputs.childBenefitRecipient === 1
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => updateInput("childBenefitRecipient", 1)}
                        >
                          Partner 1
                        </Button>
                        <Button
                          variant={
                            normalizedInputs.childBenefitRecipient === 2
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => updateInput("childBenefitRecipient", 2)}
                        >
                          Partner 2
                        </Button>
                      </div>
                    ) : null}
                    <Button
                      variant="outline"
                      onClick={addChild}
                      disabled={normalizedInputs.children.length >= 6}
                    >
                      <Plus className="size-4" />
                      Kind hinzufugen
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {normalizedInputs.children.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-background/70 px-4 py-4 text-sm text-muted-foreground">
                      Keine Kinder angelegt. Dann wird keine Kinderzulage
                      gerechnet.
                    </div>
                  ) : (
                    normalizedInputs.children.map((child, index) => (
                      <div
                        key={`${index}-${child.currentAge}-${child.eligibleUntilAge}`}
                        className="grid gap-3 rounded-xl border border-border/80 bg-background/80 p-4 md:grid-cols-[1fr_1fr_auto]"
                      >
                        <div className="space-y-2">
                          <label
                            htmlFor={`child-age-${index}`}
                            className="text-sm font-medium"
                          >
                            Kind {index + 1}: aktuelles Alter
                          </label>
                          <Input
                            id={`child-age-${index}`}
                            type="number"
                            min={0}
                            max={25}
                            value={child.currentAge}
                            onChange={(event) =>
                              updateChild(index, {
                                currentAge: Number(event.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor={`child-end-${index}`}
                            className="text-sm font-medium"
                          >
                            Kindergeld bis Alter
                          </label>
                          <Input
                            id={`child-end-${index}`}
                            type="number"
                            min={child.currentAge + 1}
                            max={25}
                            value={child.eligibleUntilAge}
                            onChange={(event) =>
                              updateChild(index, {
                                eligibleUntilAge: Number(event.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeChild(index)}
                            aria-label={`Kind ${index + 1} entfernen`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <section className="grid gap-4 xl:grid-cols-2">
              <ScenarioCard
                title="Eingestelltes Szenario"
                description="Ein Teil der Sparrate fließt ab 2027 in das AV-Depot."
                tone="primary"
                icon={Landmark}
                etfValue={splitScenario.endingEtfBalance}
                avValue={splitScenario.endingAvBalance}
                totalValue={splitScenario.totalBalance}
                subsidyValue={splitScenario.totalAvSubsidy}
                childSubsidyValue={splitScenario.totalChildSubsidy}
                taxValue={splitScenario.totalVorabTax}
              />
              <ScenarioCard
                title="Alles in ETF"
                description="Die komplette Sparrate bleibt im ETF-Sparplan."
                tone="neutral"
                icon={ChartColumnIncreasing}
                etfValue={etfOnlyScenario.endingEtfBalance}
                avValue={0}
                totalValue={etfOnlyScenario.totalBalance}
                subsidyValue={0}
                childSubsidyValue={0}
                taxValue={etfOnlyScenario.totalVorabTax}
              />
            </section>

            <Card className="border border-white/70 bg-white/88 shadow-[0_18px_80px_rgba(39,70,57,0.08)] backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl">Analyse und Daten</CardTitle>
                <CardDescription>
                  Vergleich, Annahmen und JSON-Speichern/Laden in einer Ansicht.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="analysis">
                  <TabsList className="mb-4">
                    <TabsTrigger value="analysis">Analyse</TabsTrigger>
                    <TabsTrigger value="assumptions">Annahmen</TabsTrigger>
                    <TabsTrigger value="json">JSON</TabsTrigger>
                  </TabsList>

                  <TabsContent value="analysis" className="space-y-4">
                    <Card className="border border-border/80 bg-muted/25 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">
                          Optimierung fur die Familie
                        </CardTitle>
                        <CardDescription>
                          Sucht die beste AV-Verteilung uber beide Partner und alle
                          moeglichen Depots. Dabei darf auch ein Partner komplett
                          ohne AV-Depot bleiben.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Button onClick={runOptimization} disabled={isOptimizing}>
                            {isOptimizing ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Sparkles className="size-4" />
                            )}
                            Optimum berechnen
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Die Optimierung bestimmt AV-Gesamtrate und je Partner
                            die Anzahl der Depots `0`, `1` oder `2`.
                          </span>
                        </div>

                        {optimization ? (
                          <div className="space-y-4 rounded-2xl border border-primary/20 bg-background/80 p-4">
                            <div className="grid gap-4 md:grid-cols-3">
                              <InsightCard
                                title="Optimales Familienergebnis"
                                value={formatCurrency(
                                  optimization.scenario.totalBalance
                                )}
                                description={`Diff. zu Alles-ETF: ${formatSignedCurrency(
                                  optimization.scenario.totalBalance -
                                    etfOnlyScenario.totalBalance
                                )}`}
                              />
                              <InsightCard
                                title="Gesamt ins AV"
                                value={formatCurrency(
                                  optimization.totalMonthlyAvContribution
                                )}
                                description="Vom Optimierer gewaehlte monatliche AV-Gesamtrate."
                              />
                              <InsightCard
                                title="Mehrwert gguber aktuellem Setup"
                                value={formatSignedCurrency(
                                  optimization.scenario.totalBalance -
                                    splitScenario.totalBalance
                                )}
                                description="Positiv bedeutet besser als dein aktuelles Szenario."
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              {optimization.monthlyAvByContract.map(
                                (contracts, adultIndex) => (
                                  <div
                                    key={`optimized-adult-${adultIndex + 1}`}
                                    className="rounded-xl border border-border/80 bg-muted/20 p-4"
                                  >
                                    <p className="text-sm font-medium">
                                      Partner {adultIndex + 1}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      Depots:{" "}
                                      {optimization.adultContractCounts[adultIndex] ?? 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Monatlich gesamt:{" "}
                                      {formatCurrency(
                                        optimization.monthlyAvByAdult[adultIndex] ?? 0
                                      )}
                                    </p>
                                    <div className="mt-3 space-y-2">
                                      {contracts.length === 0 ? (
                                        <ResultRow
                                          label="AV-Depot"
                                          value="kein Depot"
                                        />
                                      ) : (
                                        contracts.map((value, contractIndex) => (
                                          <ResultRow
                                            key={`optimized-${adultIndex + 1}-${contractIndex + 1}`}
                                            label={`Depot ${contractIndex + 1}`}
                                            value={formatCurrency(value)}
                                          />
                                        ))
                                      )}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2">
                      <InsightCard
                        title="Gesamter Vorteil/Nachteil"
                        value={formatSignedCurrency(splitDelta)}
                        description={`Stand zum Haushalts-Horizont im Vergleich zum reinen ETF-Szenario.`}
                      />
                      <InsightCard
                        title="ETF-Vorabpauschale im Split-Szenario"
                        value={formatCurrency(splitScenario.totalVorabTax)}
                        description={`Kumulierte Steuerlast bis ${RETIREMENT_AGE}.`}
                      />
                      <InsightCard
                        title="AV-Zulagen gesamt"
                        value={formatCurrency(splitScenario.totalAvSubsidy)}
                        description="Direkte Zulage inklusive Kinderkomponente und ggf. Starterbonus."
                      />
                      <InsightCard
                        title="Letzte Vorabpauschale"
                        value={formatCurrency(splitScenario.finalYearVorabTax)}
                        description="Naherungswert fur das letzte Sparjahr vor 67."
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="assumptions" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <AssumptionCard
                        title="ETF-Steuerannahme"
                        body={`Vorabpauschale mit Basiszins ${formatPercent(
                          ETF_VORABPAUSCHALE_BASIS_RATE * 100
                        )}, Teilfreistellung ${formatPercent(
                          ETF_PARTIAL_EXEMPTION * 100
                        )} fur Aktien-ETFs und Abgeltungsteuer inkl. Soli von ${formatPercent(
                          ETF_TAX_RATE * 100
                        )}.`}
                      />
                      <AssumptionCard
                        title="AV-Steuerannahme"
                        body="Im zertifizierten AV-Depot wird wahrend der Ansparphase keine Vorabpauschale berechnet. Die spatere Auszahlungsbesteuerung ist nicht modelliert."
                      />
                      <AssumptionCard
                        title="Familie"
                        body="Wenn du 2 Partner aktivierst, unterstellt das Modell zwei foerderfaehige Personen. Jeder Partner kann 0, 1 oder 2 AV-Depots haben. Kinderzulagen werden dem von dir gewaehlten Partner zugeordnet. Das manuelle Szenario verteilt den AV-Betrag entsprechend der gewaehlten AV-Kapazitaet; die Optimierung sucht die beste Verteilung."
                      />
                      <AssumptionCard
                        title="Kinder"
                        body="Die Kinderzulage wird pro Kind nur fur Jahre angesetzt, in denen das Kind nach deinen Eingaben noch kindergeldberechtigt sein soll. Standard ist eine konservative Grenze von 18 Jahren; bei Ausbildung/Studium kannst du bis 25 rechnen."
                      />
                      <AssumptionCard
                        title="Weitere Effekte"
                        body="Sparer-Pauschbetrag, Kirchensteuer, individuelle Einkommensteuer im Alter und moegliche Sonderausgabenwirkung sind nicht enthalten."
                      />
                    </div>

                    <Card className="border border-border/80 bg-muted/30 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">Quellenstand</CardTitle>
                        <CardDescription>
                          Die Berechnungsannahmen orientieren sich an offiziellen
                          Quellen mit Stand Marz 2026.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
                        <p>
                          <a
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            href="https://www.bundesfinanzministerium.de/Content/DE/FAQ/faq-reform-private-altersvorsorge.html"
                            target="_blank"
                            rel="noreferrer"
                          >
                            BMF-FAQ zur Reform der privaten Altersvorsorge
                          </a>
                        </p>
                        <p>
                          <a
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            href="https://www.bundesregierung.de/breg-de/aktuelles/reform-der-privaten-altersvorsorge-2317598"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Bundesregierung zur geplanten Reform
                          </a>
                        </p>
                        <p>
                          <a
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            href="https://www.gesetze-im-internet.de/invstg_2018/__18.html"
                            target="_blank"
                            rel="noreferrer"
                          >
                            InvStG § 18 Vorabpauschale
                          </a>
                        </p>
                        <p>
                          <a
                            className="font-medium text-primary underline-offset-4 hover:underline"
                            href="https://www.gesetze-im-internet.de/invstg_2018/__16.html"
                            target="_blank"
                            rel="noreferrer"
                          >
                            InvStG § 16 steuerfreie Altvorsorge-Vertrage
                          </a>
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="json" className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={exportJson}>
                        <ArrowDownToLine className="size-4" />
                        JSON exportieren
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ArrowUpFromLine className="size-4" />
                        JSON laden
                      </Button>
                      <input
                        id={fileInputId}
                        ref={fileInputRef}
                        className="hidden"
                        type="file"
                        accept="application/json"
                        onChange={handleJsonImport}
                      />
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-border/80 bg-[#10211e]">
                      <pre className="max-h-[26rem] overflow-auto px-4 py-4 font-mono text-xs leading-6 text-[#cbece0]">
                        {currentJson}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}

function SliderField({
  label,
  description,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  description: string
  valueLabel: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Badge
          variant="outline"
          className="border-primary/20 bg-primary/5 px-2.5 py-1 text-sm text-primary"
        >
          {valueLabel}
        </Badge>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(values) =>
          onChange(Number(Array.isArray(values) ? values[0] ?? min : values ?? min))
        }
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatAxisValue(min)}</span>
        <span>{formatAxisValue(max)}</span>
      </div>
    </div>
  )
}

function ContractCountSelector({
  value,
  onChange,
}: {
  value: AdultContractCount
  onChange: (value: AdultContractCount) => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/20 p-1">
      {([0, 1, 2] as AdultContractCount[]).map((option) => (
        <Button
          key={option}
          type="button"
          variant={value === option ? "default" : "ghost"}
          size="sm"
          className="min-w-10"
          onClick={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  )
}

function ScenarioCard({
  title,
  description,
  tone,
  icon: Icon,
  etfValue,
  avValue,
  totalValue,
  subsidyValue,
  childSubsidyValue,
  taxValue,
}: {
  title: string
  description: string
  tone: "primary" | "neutral"
  icon: typeof Landmark
  etfValue: number
  avValue: number
  totalValue: number
  subsidyValue: number
  childSubsidyValue: number
  taxValue: number
}) {
  return (
    <Card
      className={
        tone === "primary"
          ? "border border-primary/20 bg-white/90 shadow-[0_18px_80px_rgba(39,70,57,0.08)]"
          : "border border-border/80 bg-[#fbfaf6] shadow-[0_18px_80px_rgba(39,70,57,0.05)]"
      }
    >
      <CardHeader>
        <div className="mb-2 inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResultRow label="ETF mit 67" value={formatCurrency(etfValue)} />
        <ResultRow label="AV-Depot mit 67" value={formatCurrency(avValue)} />
        <ResultRow
          label="Zulagen gesamt"
          value={formatCurrency(subsidyValue)}
        />
        <ResultRow
          label="davon Kinderzulage"
          value={formatCurrency(childSubsidyValue)}
        />
        <ResultRow
          label="ETF-Vorabpauschale kumuliert"
          value={formatCurrency(taxValue)}
        />
        <Separator />
        <ResultRow
          label="Gesamtsumme mit 67"
          value={formatCurrency(totalValue)}
          emphasized
        />
      </CardContent>
    </Card>
  )
}

function QuickFact({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof ShieldCheck
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
      <div className="mb-3 inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/6 px-4 py-3">
      <p className="text-sm text-white/68">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function InsightCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function AssumptionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-muted/25 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  )
}

function ResultRow({
  label,
  value,
  emphasized = false,
}: {
  label: string
  value: string
  emphasized?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          emphasized
            ? "text-sm font-medium text-foreground"
            : "text-sm text-muted-foreground"
        }
      >
        {label}
      </span>
      <span className={emphasized ? "text-lg font-semibold" : "font-medium"}>
        {value}
      </span>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value))
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: 2,
  }).format(value) + " %"
}

function formatAxisValue(value: number) {
  if (value >= 1000) {
    return formatCurrency(value)
  }

  if (Number.isInteger(value)) {
    return String(value)
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}
