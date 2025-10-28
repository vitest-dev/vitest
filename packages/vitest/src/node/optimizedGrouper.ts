/**
 * Optimized Test Grouping Algorithm
 *
 * This module provides advanced test grouping strategies that optimize for:
 * 1. Minimal total execution time (load balancing)
 * 2. Early failure detection (failed tests first)
 * 3. Resource utilization (bin packing)
 * 4. Dependency awareness (minimize shared resource contention)
 * 5. Cache efficiency (co-locate related tests)
 */

import type { SuiteResultCache } from './cache/results'
import type { TestSpecification } from './spec'

export interface TestMetadata {
  spec: TestSpecification
  duration: number // milliseconds
  fileSize: number // bytes
  failed: boolean
  dependencies: Set<string> // module dependencies
  testCount?: number
  environment?: string // test environment (node, jsdom, etc)
}

export interface OptimizedGroup {
  specs: TestSpecification[]
  estimatedDuration: number
  priority: number // lower = runs earlier
  poolType: string
  projectName: string
  environment?: string // test environment
}

export interface GroupingStrategy {
  name: string
  group: (tests: TestMetadata[], maxWorkers: number) => OptimizedGroup[][]
}

/**
 * Main optimized test grouper
 */
export class OptimizedTestGrouper {
  private resultsCache: Map<string, SuiteResultCache>
  private filesCache: Map<string, { size: number }>

  constructor(
    resultsCache: Map<string, SuiteResultCache>,
    filesCache: Map<string, { size: number }>,
  ) {
    this.resultsCache = resultsCache
    this.filesCache = filesCache
  }

  /**
   * Enriches test specifications with metadata for optimization
   */
  enrichMetadata(specs: TestSpecification[], environments?: WeakMap<TestSpecification, { name: string; options: any }>): TestMetadata[] {
    return specs.map((spec) => {
      // Build cache key: "projectName:relativePath"
      const cacheKey = `${spec.project.name}:${spec.moduleId}`
      const cached = this.resultsCache.get(cacheKey)
      const fileStats = this.filesCache.get(cacheKey)
      const fileSize = fileStats?.size || 0

      return {
        spec,
        duration: cached?.duration || this.estimateDuration(fileSize),
        fileSize,
        failed: cached?.failed || false,
        dependencies: this.extractDependencies(spec),
        testCount: undefined, // Can be populated if available
        environment: environments?.get(spec)?.name,
      }
    })
  }

  /**
   * Estimates duration based on file size (heuristic: 1ms per 100 bytes)
   */
  private estimateDuration(fileSize: number): number {
    // Base assumption: larger files take longer
    // Minimum 10ms, scales with file size
    return Math.max(10, fileSize / 100)
  }

  /**
   * Extracts module dependencies from test specification
   */
  private extractDependencies(_spec: TestSpecification): Set<string> {
    // This would ideally use Vite's module graph
    // For now, return empty set - can be enhanced with actual dependency tracking
    return new Set<string>()
  }

  /**
   * Main grouping function - applies the optimal strategy
   *
   * Algorithm Overview:
   * 1. Separate tests by priority tiers (failed, slow, medium, fast)
   * 2. Within each tier, apply bin-packing for load balancing
   * 3. Group by pool type and project for execution efficiency
   * 4. Minimize dependency conflicts between parallel groups
   * 5. Ensure fair distribution across workers
   */
  group(
    specs: TestSpecification[],
    maxWorkers: number,
    strategy: 'balanced' | 'fast-fail' | 'dependency-aware' | 'resource-optimized' = 'balanced',
    environments?: WeakMap<TestSpecification, { name: string; options: any }>,
  ): OptimizedGroup[][] {
    const enriched = this.enrichMetadata(specs, environments)

    switch (strategy) {
      case 'fast-fail':
        return this.fastFailStrategy(enriched, maxWorkers)
      case 'dependency-aware':
        return this.dependencyAwareStrategy(enriched, maxWorkers)
      case 'resource-optimized':
        return this.resourceOptimizedStrategy(enriched, maxWorkers)
      case 'balanced':
      default:
        return this.balancedStrategy(enriched, maxWorkers)
    }
  }

  /**
   * BALANCED STRATEGY
   *
   * Optimizes for overall execution time by balancing load across workers.
   *
   * Steps:
   * 1. Sort by priority: failed > slow > medium > fast
   * 2. Apply longest-processing-time (LPT) bin packing
   * 3. Group by pool/project for parallel execution
   * 4. Create execution tiers with optimal parallelism
   */
  private balancedStrategy(
    tests: TestMetadata[],
    maxWorkers: number,
  ): OptimizedGroup[][] {
    // Step 1: Sort by priority
    const sorted = this.sortByPriority(tests)

    // Step 2: Group by pool, project, and environment
    const byPoolProject = this.groupByPoolProjectEnvironment(sorted)

    // Step 3: Apply bin packing to each pool/project group
    const tiers: OptimizedGroup[][] = []

    for (const [key, groupTests] of byPoolProject.entries()) {
      const [poolType, projectName, environment] = key.split('::')

      // Apply LPT (Longest Processing Time First) bin packing
      const bins = this.lptBinPacking(groupTests, maxWorkers)

      // Convert bins to OptimizedGroups
      const tier = bins.map(bin => ({
        specs: bin.map(t => t.spec),
        estimatedDuration: bin.reduce((sum, t) => sum + t.duration, 0),
        priority: this.calculatePriority(bin),
        poolType,
        projectName,
        environment: environment !== 'default' ? environment : undefined,
      }))

      tiers.push(tier)
    }

    // Step 4: Sort tiers by priority (failed tests first)
    return tiers.sort((a, b) => {
      const aPriority = Math.min(...a.map(g => g.priority))
      const bPriority = Math.min(...b.map(g => g.priority))
      return aPriority - bPriority
    })
  }

  /**
   * FAST-FAIL STRATEGY
   *
   * Prioritizes early failure detection to minimize CI time on broken builds.
   *
   * Steps:
   * 1. Create high-priority tier with all failed tests
   * 2. Distribute failed tests across all workers for parallel execution
   * 3. Create subsequent tiers with remaining tests
   * 4. Sort by duration within each tier
   */
  private fastFailStrategy(
    tests: TestMetadata[],
    maxWorkers: number,
  ): OptimizedGroup[][] {
    const failed = tests.filter(t => t.failed)
    const passed = tests.filter(t => !t.failed)

    const tiers: OptimizedGroup[][] = []

    // Tier 0: Failed tests (highest priority)
    if (failed.length > 0) {
      const failedByPool = this.groupByPoolProjectEnvironment(failed)
      const failedTier: OptimizedGroup[] = []

      for (const [key, groupTests] of failedByPool.entries()) {
        const [poolType, projectName, environment] = key.split('::')

        // Distribute failed tests across workers
        const bins = this.roundRobinDistribution(groupTests, maxWorkers)

        failedTier.push(
          ...bins.map(bin => ({
            specs: bin.map(t => t.spec),
            estimatedDuration: bin.reduce((sum, t) => sum + t.duration, 0),
            priority: 0, // Highest priority
            poolType,
            projectName,
            environment: environment !== 'default' ? environment : undefined,
          })),
        )
      }

      tiers.push(failedTier)
    }

    // Tier 1+: Passed tests (balanced)
    if (passed.length > 0) {
      const passedTiers = this.balancedStrategy(passed, maxWorkers)
      tiers.push(...passedTiers)
    }

    return tiers
  }

  /**
   * DEPENDENCY-AWARE STRATEGY
   *
   * Minimizes resource contention by grouping tests with disjoint dependencies.
   *
   * Steps:
   * 1. Build dependency conflict graph
   * 2. Apply graph coloring to find non-conflicting groups
   * 3. Balance load within each color group
   * 4. Schedule groups with conflicts sequentially
   */
  private dependencyAwareStrategy(
    tests: TestMetadata[],
    maxWorkers: number,
  ): OptimizedGroup[][] {
    // Build conflict graph
    const conflictGraph = this.buildConflictGraph(tests)

    // Apply greedy graph coloring
    const colorGroups = this.greedyGraphColoring(tests, conflictGraph)

    // Create tiers from color groups
    const tiers: OptimizedGroup[][] = []

    for (const colorTests of colorGroups) {
      const byPoolProject = this.groupByPoolProjectEnvironment(colorTests)
      const tier: OptimizedGroup[] = []

      for (const [key, groupTests] of byPoolProject.entries()) {
        const [poolType, projectName, environment] = key.split('::')

        const bins = this.lptBinPacking(groupTests, maxWorkers)

        tier.push(
          ...bins.map(bin => ({
            specs: bin.map(t => t.spec),
            estimatedDuration: bin.reduce((sum, t) => sum + t.duration, 0),
            priority: this.calculatePriority(bin),
            poolType,
            projectName,
            environment: environment !== 'default' ? environment : undefined,
          })),
        )
      }

      tiers.push(tier)
    }

    return tiers
  }

  /**
   * RESOURCE-OPTIMIZED STRATEGY
   *
   * Optimizes for memory and CPU utilization.
   *
   * Steps:
   * 1. Estimate resource requirements per test
   * 2. Apply multi-dimensional bin packing (time + memory + CPU)
   * 3. Avoid overcommitting system resources
   * 4. Balance long-running and short tests
   */
  private resourceOptimizedStrategy(
    tests: TestMetadata[],
    maxWorkers: number,
  ): OptimizedGroup[][] {
    // Estimate resource requirements
    const withResources = tests.map(t => ({
      ...t,
      estimatedMemory: this.estimateMemory(t),
      estimatedCpu: this.estimateCpu(t),
    }))

    // Apply multi-dimensional bin packing
    const bins = this.multiDimensionalBinPacking(withResources, maxWorkers)

    // Group by pool/project/environment
    const byPoolProject = new Map<string, typeof bins>()

    for (const bin of bins) {
      const environment = bin[0].environment || 'default'
      const key = `${bin[0].spec.pool}::${bin[0].spec.project.name}::${environment}`
      if (!byPoolProject.has(key)) {
        byPoolProject.set(key, [])
      }
      byPoolProject.get(key)!.push(bin)
    }

    // Create tiers
    const tiers: OptimizedGroup[][] = []

    for (const [key, poolBins] of byPoolProject.entries()) {
      const [poolType, projectName, environment] = key.split('::')

      const tier = poolBins.map(bin => ({
        specs: bin.map(t => t.spec),
        estimatedDuration: bin.reduce((sum, t) => sum + t.duration, 0),
        priority: this.calculatePriority(bin),
        poolType,
        projectName,
        environment: environment !== 'default' ? environment : undefined,
      }))

      tiers.push(tier)
    }

    return tiers
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Sorts tests by priority: failed > duration > file size
   */
  private sortByPriority(tests: TestMetadata[]): TestMetadata[] {
    return tests.slice().sort((a, b) => {
      // Failed tests first
      if (a.failed !== b.failed) {
        return a.failed ? -1 : 1
      }

      // Then by duration (longest first)
      if (a.duration !== b.duration) {
        return b.duration - a.duration
      }

      // Then by file size (largest first)
      return b.fileSize - a.fileSize
    })
  }

  /**
   * Groups tests by pool type, project, and environment
   * CRITICAL: Tests with different environments MUST NOT share workers to prevent global leaks
   */
  private groupByPoolProjectEnvironment(
    tests: TestMetadata[],
  ): Map<string, TestMetadata[]> {
    const groups = new Map<string, TestMetadata[]>()

    for (const test of tests) {
      // Include environment in the key to ensure tests with different environments
      // are never grouped together (preventing global leaks)
      const key = `${test.spec.pool}::${test.spec.project.name}::${test.environment || 'default'}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(test)
    }

    return groups
  }

  /**
   * Longest Processing Time (LPT) First Bin Packing
   *
   * Greedy algorithm that assigns each test to the bin with minimum load.
   * Optimal for minimizing makespan (total execution time).
   *
   * Time Complexity: O(n log k) where n = tests, k = bins
   */
  private lptBinPacking(
    tests: TestMetadata[],
    numBins: number,
  ): TestMetadata[][] {
    // Sort by duration descending (LPT)
    const sorted = tests.slice().sort((a, b) => b.duration - a.duration)

    // Initialize bins with load tracking
    const bins: { tests: TestMetadata[]; load: number }[] = Array.from(
      { length: Math.min(numBins, tests.length) },
      () => ({ tests: [], load: 0 }),
    )

    // Assign each test to the bin with minimum load
    for (const test of sorted) {
      // Find bin with minimum load
      let minBin = bins[0]
      for (let i = 1; i < bins.length; i++) {
        if (bins[i].load < minBin.load) {
          minBin = bins[i]
        }
      }

      minBin.tests.push(test)
      minBin.load += test.duration
    }

    return bins.map(bin => bin.tests)
  }

  /**
   * Round-robin distribution for even spread
   */
  private roundRobinDistribution(
    tests: TestMetadata[],
    numBins: number,
  ): TestMetadata[][] {
    const bins: TestMetadata[][] = Array.from({ length: numBins }, () => [])

    tests.forEach((test, index) => {
      bins[index % numBins].push(test)
    })

    return bins.filter(bin => bin.length > 0)
  }

  /**
   * Builds a conflict graph where edges represent shared dependencies
   */
  private buildConflictGraph(tests: TestMetadata[]): Map<number, Set<number>> {
    const graph = new Map<number, Set<number>>()

    for (let i = 0; i < tests.length; i++) {
      graph.set(i, new Set())
    }

    // Add edges for tests with overlapping dependencies
    for (let i = 0; i < tests.length; i++) {
      for (let j = i + 1; j < tests.length; j++) {
        if (this.hasSharedDependencies(tests[i], tests[j])) {
          graph.get(i)!.add(j)
          graph.get(j)!.add(i)
        }
      }
    }

    return graph
  }

  /**
   * Checks if two tests share dependencies
   */
  private hasSharedDependencies(a: TestMetadata, b: TestMetadata): boolean {
    for (const dep of a.dependencies) {
      if (b.dependencies.has(dep)) {
        return true
      }
    }
    return false
  }

  /**
   * Greedy graph coloring algorithm
   *
   * Assigns colors (groups) such that no two adjacent nodes (conflicting tests)
   * have the same color.
   */
  private greedyGraphColoring(
    tests: TestMetadata[],
    conflictGraph: Map<number, Set<number>>,
  ): TestMetadata[][] {
    const colors: number[] = Array.from({ length: tests.length }, () => -1)
    const colorGroups: TestMetadata[][] = []

    // Color each vertex
    for (let i = 0; i < tests.length; i++) {
      // Find available colors
      const usedColors = new Set<number>()
      for (const neighbor of conflictGraph.get(i)!) {
        if (colors[neighbor] !== -1) {
          usedColors.add(colors[neighbor])
        }
      }

      // Assign first available color
      let color = 0
      while (usedColors.has(color)) {
        color++
      }

      colors[i] = color

      // Add to color group
      if (!colorGroups[color]) {
        colorGroups[color] = []
      }
      colorGroups[color].push(tests[i])
    }

    return colorGroups.filter(group => group.length > 0)
  }

  /**
   * Multi-dimensional bin packing considering time, memory, and CPU
   */
  private multiDimensionalBinPacking(
    tests: Array<TestMetadata & { estimatedMemory: number; estimatedCpu: number }>,
    numBins: number,
  ): Array<Array<TestMetadata & { estimatedMemory: number; estimatedCpu: number }>> {
    // Sort by resource footprint (largest first)
    const sorted = tests.slice().sort((a, b) => {
      const aFootprint = a.duration * a.estimatedMemory * a.estimatedCpu
      const bFootprint = b.duration * b.estimatedMemory * b.estimatedCpu
      return bFootprint - aFootprint
    })

    // Initialize bins with multi-dimensional capacity
    const bins: {
      tests: Array<TestMetadata & { estimatedMemory: number; estimatedCpu: number }>
      time: number
      memory: number
      cpu: number
    }[] = Array.from({ length: Math.min(numBins, tests.length) }, () => ({
      tests: [],
      time: 0,
      memory: 0,
      cpu: 0,
    }))

    // Assign tests using best-fit heuristic
    for (const test of sorted) {
      // Find bin with best fit (minimum waste)
      let bestBin = bins[0]
      let bestScore = this.calculateBinScore(bestBin)

      for (let i = 1; i < bins.length; i++) {
        const score = this.calculateBinScore(bins[i])
        if (score < bestScore) {
          bestBin = bins[i]
          bestScore = score
        }
      }

      bestBin.tests.push(test)
      bestBin.time += test.duration
      bestBin.memory = Math.max(bestBin.memory, test.estimatedMemory)
      bestBin.cpu += test.estimatedCpu
    }

    return bins.map(bin => bin.tests)
  }

  /**
   * Calculates bin score for best-fit heuristic (lower is better)
   */
  private calculateBinScore(bin: {
    time: number
    memory: number
    cpu: number
  }): number {
    // Weighted sum of normalized resources
    return bin.time * 1.0 + bin.memory * 0.5 + bin.cpu * 0.3
  }

  /**
   * Estimates memory usage based on file size
   */
  private estimateMemory(test: TestMetadata): number {
    // Heuristic: file size * 10 (MB)
    return test.fileSize * 10
  }

  /**
   * Estimates CPU usage based on duration
   */
  private estimateCpu(test: TestMetadata): number {
    // Heuristic: duration / 100 (CPU cores)
    return test.duration / 100
  }

  /**
   * Calculates group priority based on constituent tests
   */
  private calculatePriority(tests: TestMetadata[]): number {
    // Priority = weighted average
    // Failed tests: 0
    // Slow tests (>5s): 10
    // Medium tests (1-5s): 50
    // Fast tests (<1s): 100

    let totalWeight = 0
    let weightedSum = 0

    for (const test of tests) {
      const weight = test.duration

      let priority: number
      if (test.failed) {
        priority = 0
      }
      else if (test.duration > 5000) {
        priority = 10
      }
      else if (test.duration > 1000) {
        priority = 50
      }
      else {
        priority = 100
      }

      weightedSum += priority * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 100
  }
}

/**
 * Optimizes test execution order within groups
 */
export function optimizeExecutionOrder(groups: OptimizedGroup[][]): OptimizedGroup[][] {
  return groups.map((tier) => {
    // Within each tier, sort groups by priority
    return tier.slice().sort((a, b) => a.priority - b.priority)
  })
}

/**
 * Analyzes and reports grouping efficiency
 */
export function analyzeGroupingEfficiency(groups: OptimizedGroup[][]): {
  totalGroups: number
  totalTests: number
  estimatedTotalTime: number
  averageGroupSize: number
  loadBalance: number // 0-1, closer to 1 = better balance
  parallelism: number
} {
  let totalGroups = 0
  let totalTests = 0
  let estimatedTotalTime = 0

  const tierDurations: number[] = []

  for (const tier of groups) {
    totalGroups += tier.length

    let maxDurationInTier = 0
    for (const group of tier) {
      totalTests += group.specs.length
      maxDurationInTier = Math.max(maxDurationInTier, group.estimatedDuration)
    }

    tierDurations.push(maxDurationInTier)
    estimatedTotalTime += maxDurationInTier
  }

  const averageGroupSize = totalTests / totalGroups

  // Calculate load balance (coefficient of variation)
  const allDurations = groups.flat().map(g => g.estimatedDuration)
  const meanDuration = allDurations.reduce((a, b) => a + b, 0) / allDurations.length
  const variance
    = allDurations.reduce((sum, d) => sum + (d - meanDuration) ** 2, 0)
      / allDurations.length
  const stdDev = Math.sqrt(variance)
  const coefficientOfVariation = meanDuration > 0 ? stdDev / meanDuration : 0
  const loadBalance = Math.max(0, 1 - coefficientOfVariation)

  // Calculate average parallelism
  const parallelism = groups.reduce((sum, tier) => sum + tier.length, 0) / groups.length

  return {
    totalGroups,
    totalTests,
    estimatedTotalTime,
    averageGroupSize,
    loadBalance,
    parallelism,
  }
}
