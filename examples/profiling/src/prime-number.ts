/* eslint-disable unicorn/no-new-array */

const store: bigint[] = []

export default function getPrimeNumber(bitLength: number): bigint {
  if (!bitLength) {
    throw new Error('bitLength is required')
  }

  const number = randomBigInt(bitLength)

  if (isPrimeNumber(number) && !store.includes(number)) {
    store.push(number)

    return number
  }

  return getPrimeNumber(bitLength)
}

/**
 * Generate random `BigInt` with given bit length
 * e.g. randomBigInt(8) -> 153n (1001 1001)
 */
function randomBigInt(bitLength: number): bigint {
  const binaryString: string = new Array(bitLength)
    // MSB should be one to guarantee bit length
    .fill('1')
    // Fill string with 0s and 1s
    .reduce(bin => bin + Math.round(Math.random()).toString())

  return BigInt(`0b${binaryString}`)
}

function isPrimeNumber(number: bigint): boolean {
  if (number <= 2n) {
    return false
  }

  if (number % 2n === 0n) {
    return false
  }

  if (number === 3n) {
    return true
  }

  const squareRoot = bigIntSquareRoot(number)

  // Intentionally unefficient to highlight performance issues
  for (let i = 3n; i < squareRoot; i += 2n) {
    if (number % i === 0n) {
      return false
    }
  }

  return true
}

function bigIntSquareRoot(number: bigint): bigint {
  if (number < 0n) {
    throw new Error('Negative numbers are not supported')
  }
  if (number < 2n) {
    return number
  }

  function iterate(value: bigint, guess: bigint): bigint {
    const nextGuess = (value / guess + guess) >> 1n

    if (guess === nextGuess) {
      return guess
    }
    if (guess === nextGuess - 1n) {
      return guess
    }

    return iterate(value, nextGuess)
  }

  return iterate(number, 1n)
}
