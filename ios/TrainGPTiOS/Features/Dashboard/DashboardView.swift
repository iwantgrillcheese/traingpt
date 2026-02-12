import SwiftUI

struct DashboardView: View {
    @StateObject var viewModel: DashboardViewModel

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading")
                } else if let summary = viewModel.summary {
                    VStack(spacing: 12) {
                        MetricCard(title: "Current Week Volume", value: "\(summary.currentWeekVolume)")
                        MetricCard(title: "Sessions Completed", value: "\(summary.sessionsCompleted)")
                        MetricCard(title: "Adherence", value: "\(Int(summary.adherence * 100))%")
                        Spacer()
                    }
                    .padding()
                } else {
                    ContentUnavailableView(
                        "No data yet",
                        systemImage: "chart.bar",
                        description: Text(viewModel.errorMessage ?? "Your weekly metrics will appear here.")
                    )
                }
            }
            .navigationTitle("Dashboard")
            .task {
                await viewModel.load()
            }
        }
    }
}

private struct MetricCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3)
                .fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
