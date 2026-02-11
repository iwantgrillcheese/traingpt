import Foundation

@MainActor
final class AppContainer: ObservableObject {
    let sessionState: SessionState
    let authService: AuthServiceProtocol
    let dashboardService: DashboardServiceProtocol

    init(
        sessionState: SessionState,
        authService: AuthServiceProtocol,
        dashboardService: DashboardServiceProtocol
    ) {
        self.sessionState = sessionState
        self.authService = authService
        self.dashboardService = dashboardService
    }

    static let live: AppContainer = {
        let tokenStore = KeychainTokenStore()
        let apiClient = APIClient(baseURL: AppEnvironment.current.apiBaseURL, tokenStore: tokenStore)
        let sessionState = SessionState(tokenStore: tokenStore)
        let authService = AuthService(apiClient: apiClient, tokenStore: tokenStore)
        let dashboardService = DashboardService(apiClient: apiClient)

        return AppContainer(
            sessionState: sessionState,
            authService: authService,
            dashboardService: dashboardService
        )
    }()
}
