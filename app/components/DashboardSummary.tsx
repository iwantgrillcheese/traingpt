useEffect(() => {
  const fetchData = async () => {
    const res = await fetch('/api/strava_sync');
    const json = await res.json();
    console.log('[Strava Dashboard Data]', json); // ✅ Key debug log
    const { data } = json;

    const totals: Record<SportCategory, number> = {
      Swim: 0,
      Bike: 0,
      Run: 0,
    };

    const activeDays = new Set<string>();
    const weeks: Record<string, number> = {};
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);

    data.forEach((a: any) => {
      const mapped = categoryMap[a.sport_type?.toLowerCase()];
      if (!mapped) return;

      const activityDate = new Date(a.start_date_local);
      const dateKey = format(activityDate, 'yyyy-MM-dd');
      const weekKey = format(startOfWeek(activityDate), 'yyyy-MM-dd');
      const hours = a.moving_time / 3600;

      if (activityDate >= sevenDaysAgo && activityDate <= today) {
        totals[mapped] += hours;
        activeDays.add(dateKey);
      }

      weeks[weekKey] = (weeks[weekKey] || 0) + hours;
    });

    const weeklyVolume = Object.values(weeks).slice(-4);

    setSummary({
      totalTime: parseFloat(
        Object.values(totals).reduce((a, b) => a + b, 0).toFixed(1)
      ),
      weeklyVolume,
      sportBreakdown: (['Swim', 'Bike', 'Run'] as SportCategory[]).map((sport, i) => ({
        name: sport,
        value: parseFloat(totals[sport].toFixed(1)),
      })),
      consistency: `${activeDays.size} of last 7 days`,
    });
  };

  fetchData();
}, []);
