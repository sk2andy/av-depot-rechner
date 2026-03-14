export const CALCULATION_START_YEAR = 2027
export const RETIREMENT_AGE = 67

export const AV_MAX_ANNUAL_CONTRIBUTION_PER_CONTRACT = 6840
export const AV_SUBSIDY_FIRST_TIER_CAP = 1200
export const AV_SUBSIDY_SECOND_TIER_CAP = 600
export const AV_SUBSIDY_FIRST_TIER_RATE_2027 = 0.3
export const AV_SUBSIDY_FIRST_TIER_RATE_2029 = 0.35
export const AV_SUBSIDY_SECOND_TIER_RATE = 0.2
export const AV_CHILD_SUBSIDY_RATE = 0.25
export const AV_STARTER_BONUS = 200

export const ETF_PARTIAL_EXEMPTION = 0.3
export const ETF_TAX_RATE = 0.26375
export const ETF_VORABPAUSCHALE_BASIS_RATE = 0.032
export const ETF_VORABPAUSCHALE_FACTOR = 0.7

export type ContractCount = 1 | 2
export type AdultCount = 1 | 2
export type AdultContractCount = 0 | 1 | 2
export type ChildProfile = {
  currentAge: number
  eligibleUntilAge: number
}

export type CalculatorInputs = {
  etfFeePercent: number
  avFeePercent: number
  totalMonthlySavings: number
  monthlyAvContribution: number
  adultCount: AdultCount
  contractCount: ContractCount
  partnerAContractCount: AdultContractCount
  partnerBContractCount: AdultContractCount
  childBenefitRecipient: 1 | 2
  annualReturnPercent: number
  startingEtfBalance: number
  partnerAAge: number
  partnerBAge: number
  children: ChildProfile[]
}

export type YearSnapshot = {
  year: number
  age: number
  endingEtfBalance: number
  endingAvBalance: number
  vorabTax: number
  avSubsidy: number
  childSubsidy: number
}

export type ScenarioResult = {
  endingEtfBalance: number
  endingAvBalance: number
  endingAvContractBalances: number[]
  totalBalance: number
  totalEtfContributions: number
  totalAvContributions: number
  totalVorabTax: number
  totalAvSubsidy: number
  totalChildSubsidy: number
  totalStarterBonus: number
  finalYearVorabTax: number
  snapshots: YearSnapshot[]
}

export type ComparisonResult = {
  normalizedInputs: CalculatorInputs
  householdYearsToRetirement: number
  householdRetirementYear: number
  partnerYearsToRetirement: number[]
  maxAnnualAvContribution: number
  maxMonthlyAvContribution: number
  totalAvContracts: number
  splitScenario: ScenarioResult
  etfOnlyScenario: ScenarioResult
}

type ScenarioConfig = {
  adultMonthlyAvContributions: number[]
  adultContractCounts: AdultContractCount[]
}

export type OptimizationResult = {
  objectiveValue: number
  totalMonthlyAvContribution: number
  monthlyAvByAdult: number[]
  adultContractCounts: AdultContractCount[]
  monthlyAvByContract: number[][]
  scenario: ScenarioResult
}

export function clampInputs(inputs: CalculatorInputs): CalculatorInputs {
  const adultCount = inputs.adultCount === 2 ? 2 : 1
  const partnerAContractCount = clampAdultContractCount(
    inputs.partnerAContractCount ?? inputs.contractCount ?? 1
  )
  const partnerBContractCount =
    adultCount === 2
      ? clampAdultContractCount(
          inputs.partnerBContractCount ??
            inputs.contractCount ??
            partnerAContractCount
        )
      : 0
  const adultContractCounts = getConfiguredAdultContractCounts({
    adultCount,
    partnerAContractCount,
    partnerBContractCount,
  })
  const totalMonthlySavings = clamp(inputs.totalMonthlySavings, 0, 5000)
  const maxMonthlyAvContribution =
    getMaxAnnualAvContributionFromCounts(adultContractCounts) / 12
  const monthlyAvContribution = clamp(
    inputs.monthlyAvContribution,
    0,
    Math.min(totalMonthlySavings, maxMonthlyAvContribution)
  )

  return {
    etfFeePercent: clamp(inputs.etfFeePercent, 0, 3),
    avFeePercent: clamp(inputs.avFeePercent, 0, 3),
    totalMonthlySavings,
    monthlyAvContribution,
    adultCount,
    contractCount: getLegacyContractCount(
      partnerAContractCount,
      partnerBContractCount
    ),
    partnerAContractCount,
    partnerBContractCount,
    childBenefitRecipient: adultCount === 1 ? 1 : inputs.childBenefitRecipient === 2 ? 2 : 1,
    annualReturnPercent: clamp(inputs.annualReturnPercent, 0, 12),
    startingEtfBalance: clamp(inputs.startingEtfBalance, 0, 1_000_000),
    partnerAAge: clamp(inputs.partnerAAge, 18, RETIREMENT_AGE),
    partnerBAge:
      adultCount === 2 ? clamp(inputs.partnerBAge, 18, RETIREMENT_AGE) : clamp(inputs.partnerAAge, 18, RETIREMENT_AGE),
    children: clampChildren(inputs.children),
  }
}

export function compareStrategies(rawInputs: CalculatorInputs): ComparisonResult {
  const normalizedInputs = clampInputs(rawInputs)
  const partnerYearsToRetirement = getPartnerYearsToRetirement(normalizedInputs)
  const householdYearsToRetirement = Math.max(...partnerYearsToRetirement)
  const manualAdultContractCounts = getConfiguredAdultContractCounts(
    normalizedInputs
  )

  const splitScenario = simulateScenario(normalizedInputs, {
    adultMonthlyAvContributions: distributeAcrossAdultCapacities(
      normalizedInputs.monthlyAvContribution,
      manualAdultContractCounts
    ),
    adultContractCounts: manualAdultContractCounts,
  })

  const etfOnlyScenario = simulateScenario(normalizedInputs, {
    adultMonthlyAvContributions: Array.from(
      { length: normalizedInputs.adultCount },
      () => 0
    ),
    adultContractCounts: Array.from(
      { length: normalizedInputs.adultCount },
      () => 0
    ) as AdultContractCount[],
  })

  return {
    normalizedInputs,
    householdYearsToRetirement,
    householdRetirementYear: CALCULATION_START_YEAR + householdYearsToRetirement,
    partnerYearsToRetirement,
    maxAnnualAvContribution: getMaxAnnualAvContributionFromCounts(
      manualAdultContractCounts
    ),
    maxMonthlyAvContribution: getMaxAnnualAvContributionFromCounts(
      manualAdultContractCounts
    ) / 12,
    totalAvContracts: manualAdultContractCounts.reduce<number>(
      (sum, count) => sum + count,
      0
    ),
    splitScenario,
    etfOnlyScenario,
  }
}

export function optimizeAvAllocation(
  rawInputs: CalculatorInputs,
  step = 10
): OptimizationResult {
  const normalizedInputs = clampInputs(rawInputs)
  const stepSize = Math.max(step, 10)

  let bestAdultAllocations = Array.from(
    { length: normalizedInputs.adultCount },
    () => 0
  )
  let bestAdultContractCounts = Array.from(
    { length: normalizedInputs.adultCount },
    () => 0
  ) as AdultContractCount[]
  let bestScenario = simulateScenario(normalizedInputs, {
    adultMonthlyAvContributions: bestAdultAllocations,
    adultContractCounts: bestAdultContractCounts,
  })
  let bestObjective = bestScenario.totalBalance

  const contractCountCombinations =
    normalizedInputs.adultCount === 1
      ? ([[0], [1], [2]] as AdultContractCount[][])
      : ([
          [0, 0],
          [0, 1],
          [0, 2],
          [1, 0],
          [1, 1],
          [1, 2],
          [2, 0],
          [2, 1],
          [2, 2],
        ] as AdultContractCount[][])

  for (const adultContractCounts of contractCountCombinations) {
    const firstAdultMaxMonthlyContribution = getMaxMonthlyContributionForAdult(
      adultContractCounts[0]
    )

    if (normalizedInputs.adultCount === 1) {
      for (
        let partnerOneContribution = 0;
        partnerOneContribution <=
        Math.min(firstAdultMaxMonthlyContribution, normalizedInputs.totalMonthlySavings);
        partnerOneContribution += stepSize
      ) {
        const adultMonthlyAvContributions = [partnerOneContribution]
        const scenario = simulateScenario(normalizedInputs, {
          adultMonthlyAvContributions,
          adultContractCounts,
        })

        if (
          isBetterOptimizationCandidate(
            scenario.totalBalance,
            bestObjective,
            adultMonthlyAvContributions,
            bestAdultAllocations,
            adultContractCounts,
            bestAdultContractCounts
          )
        ) {
          bestObjective = scenario.totalBalance
          bestScenario = scenario
          bestAdultAllocations = adultMonthlyAvContributions
          bestAdultContractCounts = adultContractCounts
        }
      }
      continue
    }

    const secondAdultMaxMonthlyContribution = getMaxMonthlyContributionForAdult(
      adultContractCounts[1]
    )

    for (
      let partnerOneContribution = 0;
      partnerOneContribution <=
      Math.min(firstAdultMaxMonthlyContribution, normalizedInputs.totalMonthlySavings);
      partnerOneContribution += stepSize
    ) {
      for (
        let partnerTwoContribution = 0;
        partnerTwoContribution <= Math.min(
          secondAdultMaxMonthlyContribution,
          normalizedInputs.totalMonthlySavings - partnerOneContribution
        );
        partnerTwoContribution += stepSize
      ) {
        const adultMonthlyAvContributions = [
          partnerOneContribution,
          partnerTwoContribution,
        ]
        const scenario = simulateScenario(normalizedInputs, {
          adultMonthlyAvContributions,
          adultContractCounts,
        })

        if (
          isBetterOptimizationCandidate(
            scenario.totalBalance,
            bestObjective,
            adultMonthlyAvContributions,
            bestAdultAllocations,
            adultContractCounts,
            bestAdultContractCounts
          )
        ) {
          bestObjective = scenario.totalBalance
          bestScenario = scenario
          bestAdultAllocations = adultMonthlyAvContributions
          bestAdultContractCounts = adultContractCounts
        }
      }
    }
  }

  return {
    objectiveValue: bestObjective,
    totalMonthlyAvContribution: bestAdultAllocations.reduce(
      (sum, value) => sum + value,
      0
    ),
    monthlyAvByAdult: bestAdultAllocations,
    adultContractCounts: bestAdultContractCounts,
    monthlyAvByContract: bestAdultAllocations.map((contribution, adultIndex) =>
      distributeAcrossContracts(contribution, bestAdultContractCounts[adultIndex])
    ),
    scenario: bestScenario,
  }
}

export function getMaxAnnualAvContribution(
  contractCount: ContractCount,
  adultCount: AdultCount
) {
  return AV_MAX_ANNUAL_CONTRIBUTION_PER_CONTRACT * contractCount * adultCount
}

export function getEligibleChildrenForYear(
  children: ChildProfile[],
  yearOffset: number
) {
  return children.filter((child) => {
    const ageInYear = child.currentAge + yearOffset
    return ageInYear < child.eligibleUntilAge
  }).length
}

function simulateScenario(
  inputs: CalculatorInputs,
  config: ScenarioConfig
): ScenarioResult {
  const partnerYearsToRetirement = getPartnerYearsToRetirement(inputs)
  const householdYearsToRetirement = Math.max(...partnerYearsToRetirement)
  const grossReturn = inputs.annualReturnPercent / 100
  const etfFee = inputs.etfFeePercent / 100
  const avFee = inputs.avFeePercent / 100

  const etfMonthlyReturn = annualToMonthlyReturn(grossReturn, etfFee)
  const avMonthlyReturn = annualToMonthlyReturn(grossReturn, avFee)

  let etfBalance = inputs.startingEtfBalance
  const avContractBalancesByAdult = config.adultContractCounts.map((count) =>
    Array.from({ length: count }, () => 0)
  )

  let totalVorabTax = 0
  let totalEtfContributions = inputs.startingEtfBalance
  let totalAvContributions = 0
  let totalAvSubsidy = 0
  let totalChildSubsidy = 0
  let totalStarterBonus = 0
  let finalYearVorabTax = 0

  const snapshots: YearSnapshot[] = []

  for (
    let yearIndex = 0;
    yearIndex < householdYearsToRetirement;
    yearIndex += 1
  ) {
    const year = CALCULATION_START_YEAR + yearIndex
    const age = inputs.partnerAAge + yearIndex

    const openingEtfBalance = etfBalance
    const adultMonthlyAvContributions = config.adultMonthlyAvContributions.map(
      (monthlyContribution, adultIndex) =>
        yearIndex < partnerYearsToRetirement[adultIndex] ? monthlyContribution : 0
    )
    const monthlyActiveAvContribution = adultMonthlyAvContributions.reduce(
      (sum, value) => sum + value,
      0
    )
    const annualEtfContribution =
      (inputs.totalMonthlySavings - monthlyActiveAvContribution) * 12

    const etfGrowth = growWithMonthlyContributions(
      etfBalance,
      inputs.totalMonthlySavings - monthlyActiveAvContribution,
      etfMonthlyReturn
    )
    etfBalance = etfGrowth.endingBalance
    totalEtfContributions += annualEtfContribution

    const vorabTax = calculateVorabTax({
      openingBalance: openingEtfBalance,
      balanceBeforeTax: etfBalance,
      annualContribution: annualEtfContribution,
      weightedTaxBase: etfGrowth.weightedTaxBase,
    })

    etfBalance = Math.max(etfBalance - vorabTax, 0)
    totalVorabTax += vorabTax
    finalYearVorabTax = vorabTax

    const eligibleChildren = getEligibleChildrenForYear(inputs.children, yearIndex)

    let annualAvSubsidy = 0
    let annualChildSubsidy = 0

    for (let adultIndex = 0; adultIndex < inputs.adultCount; adultIndex += 1) {
      const adultMonthlyContribution = adultMonthlyAvContributions[adultIndex]
      const annualAdultAvContribution = adultMonthlyContribution * 12
      totalAvContributions += annualAdultAvContribution
      const monthlyPerContractContributions = distributeAcrossContracts(
        adultMonthlyContribution,
        config.adultContractCounts[adultIndex]
      )

      for (
        let contractIndex = 0;
        contractIndex < config.adultContractCounts[adultIndex];
        contractIndex += 1
      ) {
        const avGrowth = growWithMonthlyContributions(
          avContractBalancesByAdult[adultIndex][contractIndex],
          monthlyPerContractContributions[contractIndex],
          avMonthlyReturn
        )
        avContractBalancesByAdult[adultIndex][contractIndex] =
          avGrowth.endingBalance
      }

      const subsidy = calculateAvSubsidy({
        annualOwnContribution: annualAdultAvContribution,
        year,
        eligibleChildren:
          adultIndex === inputs.childBenefitRecipient - 1 ? eligibleChildren : 0,
        ageAtStart:
          adultIndex === 0 ? inputs.partnerAAge : inputs.partnerBAge,
      })

      const activeContractCount = config.adultContractCounts[adultIndex]
      const subsidyPerContract =
        activeContractCount > 0 ? subsidy.total / activeContractCount : 0
      for (
        let contractIndex = 0;
        contractIndex < activeContractCount;
        contractIndex += 1
      ) {
        avContractBalancesByAdult[adultIndex][contractIndex] += subsidyPerContract
      }

      totalAvSubsidy += subsidy.total
      totalChildSubsidy += subsidy.child
      totalStarterBonus += subsidy.starterBonus
      annualAvSubsidy += subsidy.total
      annualChildSubsidy += subsidy.child
    }

    const avBalance = avContractBalancesByAdult.flat().reduce(
      (sum, balance) => sum + balance,
      0
    )

    snapshots.push({
      year,
      age,
      endingEtfBalance: etfBalance,
      endingAvBalance: avBalance,
      vorabTax,
      avSubsidy: annualAvSubsidy,
      childSubsidy: annualChildSubsidy,
    })
  }

  const endingAvContractBalances = avContractBalancesByAdult.flat()
  const endingAvBalance = endingAvContractBalances.reduce(
    (sum, balance) => sum + balance,
    0
  )

  return {
    endingEtfBalance: etfBalance,
    endingAvBalance,
    endingAvContractBalances,
    totalBalance: etfBalance + endingAvBalance,
    totalEtfContributions,
    totalAvContributions,
    totalVorabTax,
    totalAvSubsidy,
    totalChildSubsidy,
    totalStarterBonus,
    finalYearVorabTax,
    snapshots,
  }
}

function annualToMonthlyReturn(grossReturn: number, annualFee: number) {
  const annualNetReturn = (1 + grossReturn) * (1 - annualFee) - 1
  return Math.pow(1 + annualNetReturn, 1 / 12) - 1
}

function growWithMonthlyContributions(
  openingBalance: number,
  monthlyContribution: number,
  monthlyReturn: number
) {
  let endingBalance = openingBalance
  let weightedTaxBase = openingBalance

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    endingBalance += monthlyContribution
    endingBalance *= 1 + monthlyReturn
    weightedTaxBase += monthlyContribution * ((12 - monthIndex) / 12)
  }

  return { endingBalance, weightedTaxBase }
}

function calculateVorabTax({
  openingBalance,
  balanceBeforeTax,
  annualContribution,
  weightedTaxBase,
}: {
  openingBalance: number
  balanceBeforeTax: number
  annualContribution: number
  weightedTaxBase: number
}) {
  const annualGain = Math.max(
    balanceBeforeTax - openingBalance - annualContribution,
    0
  )

  if (annualGain <= 0) {
    return 0
  }

  const maximumVorab = weightedTaxBase * ETF_VORABPAUSCHALE_FACTOR * ETF_VORABPAUSCHALE_BASIS_RATE
  const vorabpauschale = Math.min(annualGain, maximumVorab)
  const taxableAmount = vorabpauschale * (1 - ETF_PARTIAL_EXEMPTION)

  return taxableAmount * ETF_TAX_RATE
}

function calculateAvSubsidy({
  annualOwnContribution,
  year,
  eligibleChildren,
  ageAtStart,
}: {
  annualOwnContribution: number
  year: number
  eligibleChildren: number
  ageAtStart: number
}) {
  if (annualOwnContribution <= 0) {
    return {
      total: 0,
      basic: 0,
      secondTier: 0,
      child: 0,
      starterBonus: 0,
    }
  }

  const firstTierRate =
    year >= 2029
      ? AV_SUBSIDY_FIRST_TIER_RATE_2029
      : AV_SUBSIDY_FIRST_TIER_RATE_2027
  const firstTier = Math.min(annualOwnContribution, AV_SUBSIDY_FIRST_TIER_CAP)
  const secondTier = Math.min(
    Math.max(annualOwnContribution - AV_SUBSIDY_FIRST_TIER_CAP, 0),
    AV_SUBSIDY_SECOND_TIER_CAP
  )
  const childBase = Math.min(annualOwnContribution, AV_SUBSIDY_FIRST_TIER_CAP)

  const basic = firstTier * firstTierRate
  const extra = secondTier * AV_SUBSIDY_SECOND_TIER_RATE
  const child = childBase * AV_CHILD_SUBSIDY_RATE * eligibleChildren
  const starterBonus =
    year === CALCULATION_START_YEAR && ageAtStart < 25 ? AV_STARTER_BONUS : 0

  return {
    total: basic + extra + child + starterBonus,
    basic,
    secondTier: extra,
    child,
    starterBonus,
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

function clampChildren(children: ChildProfile[]) {
  return (children ?? []).slice(0, 10).map((child) => {
    const currentAge = clamp(Math.round(child.currentAge ?? 0), 0, 25)
    const eligibleUntilAge = clamp(
      Math.round(child.eligibleUntilAge ?? 18),
      currentAge + 1,
      25
    )

    return {
      currentAge,
      eligibleUntilAge,
    }
  })
}

function getPartnerYearsToRetirement(inputs: CalculatorInputs) {
  return [
    Math.max(RETIREMENT_AGE - inputs.partnerAAge, 0),
    ...(inputs.adultCount === 2
      ? [Math.max(RETIREMENT_AGE - inputs.partnerBAge, 0)]
      : []),
  ]
}

function clampAdultContractCount(value: number) {
  const roundedValue = Math.round(Number(value) || 0)

  if (roundedValue <= 0) {
    return 0
  }

  if (roundedValue === 1) {
    return 1
  }

  return 2
}

function getConfiguredAdultContractCounts({
  adultCount,
  partnerAContractCount,
  partnerBContractCount,
}: Pick<
  CalculatorInputs,
  "adultCount" | "partnerAContractCount" | "partnerBContractCount"
>) {
  return adultCount === 2
    ? [partnerAContractCount, partnerBContractCount]
    : [partnerAContractCount]
}

function getMaxAnnualAvContributionFromCounts(
  adultContractCounts: AdultContractCount[]
) {
  return adultContractCounts.reduce<number>(
    (sum, contractCount) =>
      sum + AV_MAX_ANNUAL_CONTRIBUTION_PER_CONTRACT * contractCount,
    0
  )
}

function getLegacyContractCount(
  partnerAContractCount: AdultContractCount,
  partnerBContractCount: AdultContractCount
): ContractCount {
  return Math.max(partnerAContractCount, partnerBContractCount, 1) === 2 ? 2 : 1
}

function distributeAcrossAdultCapacities(
  totalMonthlyAvContribution: number,
  adultContractCounts: AdultContractCount[]
) {
  const capacities = adultContractCounts.map((contractCount) =>
    getMaxMonthlyContributionForAdult(contractCount)
  )
  const totalCapacity = capacities.reduce((sum, value) => sum + value, 0)

  if (totalMonthlyAvContribution <= 0 || totalCapacity <= 0) {
    return capacities.map(() => 0)
  }

  return capacities.map((capacity) =>
    capacity > 0 ? (totalMonthlyAvContribution * capacity) / totalCapacity : 0
  )
}

function distributeAcrossContracts(
  totalMonthlyContribution: number,
  contractCount: AdultContractCount
) {
  const monthlyCapPerContract =
    AV_MAX_ANNUAL_CONTRIBUTION_PER_CONTRACT / 12
  const allocations = Array.from({ length: contractCount }, () => 0)
  let remaining = totalMonthlyContribution

  for (let contractIndex = 0; contractIndex < contractCount; contractIndex += 1) {
    const allocation = Math.min(remaining, monthlyCapPerContract)
    allocations[contractIndex] = allocation
    remaining -= allocation
  }

  return allocations
}

function getMaxMonthlyContributionForAdult(contractCount: AdultContractCount) {
  return (AV_MAX_ANNUAL_CONTRIBUTION_PER_CONTRACT * contractCount) / 12
}

function isBetterOptimizationCandidate(
  candidateValue: number,
  currentBestValue: number,
  candidateMonthlyAvByAdult: number[],
  currentMonthlyAvByAdult: number[],
  candidateContractCounts: AdultContractCount[],
  currentContractCounts: AdultContractCount[]
) {
  const epsilon = 1e-6

  if (candidateValue > currentBestValue + epsilon) {
    return true
  }

  if (Math.abs(candidateValue - currentBestValue) <= epsilon) {
    const candidateMonthlyTotal = candidateMonthlyAvByAdult.reduce(
      (sum, value) => sum + value,
      0
    )
    const currentMonthlyTotal = currentMonthlyAvByAdult.reduce(
      (sum, value) => sum + value,
      0
    )

    if (candidateMonthlyTotal < currentMonthlyTotal) {
      return true
    }

    if (candidateMonthlyTotal === currentMonthlyTotal) {
      const candidateDepotTotal = candidateContractCounts.reduce<number>(
        (sum, value) => sum + value,
        0
      )
      const currentDepotTotal = currentContractCounts.reduce<number>(
        (sum, value) => sum + value,
        0
      )

      return candidateDepotTotal < currentDepotTotal
    }
  }

  return false
}
