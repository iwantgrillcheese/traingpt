import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var summary: DashboardSummary?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let service: DashboardServiceProtocol

    init(service: DashboardServiceProtocol) {
        self.service = service
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            summary = try await service.fetchSummary()
        } catch {
            errorMessage = "Could not load your dashboard."
        }
    }
}
