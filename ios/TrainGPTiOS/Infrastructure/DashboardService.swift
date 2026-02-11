import Foundation

struct DashboardService: DashboardServiceProtocol {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func fetchSummary() async throws -> DashboardSummary {
        let data = try await apiClient.request(path: "dashboard/summary")
        return try JSONDecoder().decode(DashboardSummary.self, from: data)
    }
}
