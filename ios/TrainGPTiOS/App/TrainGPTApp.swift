import SwiftUI

@main
struct TrainGPTApp: App {
    @StateObject private var appContainer = AppContainer.live

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appContainer)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var container: AppContainer

    var body: some View {
        Group {
            if container.sessionState.isAuthenticated {
                DashboardView(viewModel: DashboardViewModel(service: container.dashboardService))
            } else {
                AuthView(viewModel: AuthViewModel(service: container.authService, sessionState: container.sessionState))
            }
        }
    }
}
