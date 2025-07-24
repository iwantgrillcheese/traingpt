// /utils/coaching-utils.ts

export function getSummaryTextFromAdherence(adherence: number): string {
  if (adherence >= 100) {
    return "Crushed it! 100% completion. You nailed every session this week. 🔥";
  } else if (adherence >= 80) {
    return "Strong consistency — you completed most of your plan. Keep the momentum!";
  } else if (adherence >= 60) {
    return "Decent week, but there’s room to improve. Let’s refocus next week. 💪";
  } else if (adherence > 0) {
    return "Low adherence this week. Life happens — let’s reset and refocus. 🚀";
  } else {
    return "No sessions planned — likely a rest or taper week.";
  }
}
