export function getCurrentAcademicPeriod(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth() + 1
  const suffix = month <= 6 ? 'A' : 'B'
  return `${year}-${suffix}`
}
