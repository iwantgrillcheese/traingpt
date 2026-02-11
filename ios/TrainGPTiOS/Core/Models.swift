import Foundation

struct UserProfile: Codable, Equatable {
    let id: UUID
    let email: String
    let firstName: String?
}

struct DashboardSummary: Codable, Equatable {
    let currentWeekVolume: Int
    let sessionsCompleted: Int
    let adherence: Double
}
