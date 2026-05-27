export const generateMockBots = () => {
  const STRATEGIES = [
    { id: 'mock-1', name: 'CNPS4-BB/SMAhtf', type: 'LONG' },
    { id: 'mock-2', name: 'CNPS4-BB/SMAhtf', type: 'SHORT' },
    { id: 'mock-3', name: 'CNPS5-SMA/ADX', type: 'LONG' },
    { id: 'mock-4', name: 'CNPS5-SMA/ADX', type: 'SHORT' },
    { id: 'mock-5', name: 'CNPS6-BB/ADX', type: 'LONG' },
    { id: 'mock-6', name: 'CNPS6-BB/ADX', type: 'SHORT' },
    { id: 'mock-7', name: 'CNPS7-3SMACross', type: 'LONG' },
    { id: 'mock-8', name: 'CNPS7-3SMACross', type: 'SHORT' },
  ];

  const bots = [];
  const now = new Date();
  
  STRATEGIES.forEach((strat) => {
    const deals = [];
    let currentNav = 30000000;
    const maxDeals = Math.floor(Math.random() * 200) + 150; // 150-350 deals
    
    let totalWins = 0;
    let totalLosses = 0;
    let maxDrawdown = 0;
    let highestNav = 30000000;

    for (let i = 0; i < maxDeals; i++) {
      // spread deals over the last 365 days
      const daysAgo = 365 - (i * (365 / maxDeals));
      let dealTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      dealTime.setHours(9 + Math.floor(Math.random() * 5)); // 9 AM to 2 PM
      dealTime.setMinutes(Math.floor(Math.random() * 60));

      // Force the last 10 deals to be EXACTLY TODAY (within the last 8 hours)
      if (i > maxDeals - 10) {
        dealTime = new Date(now.getTime() - Math.random() * 8 * 60 * 60 * 1000);
      }

      const isWin = Math.random() > 0.45; // 55% win rate
      let profit = 0;
      if (isWin) {
        profit = Math.floor(Math.random() * 1500000) + 100000; // 100k to 1.6m profit
        totalWins++;
      } else {
        profit = -(Math.floor(Math.random() * 1000000) + 100000); // 100k to 1.1m loss
        totalLosses++;
      }

      currentNav += profit;
      if (currentNav > highestNav) highestNav = currentNav;
      const dd = ((highestNav - currentNav) / highestNav) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;

      deals.push({
        id: `deal-${strat.id}-${i}`,
        closeTime: dealTime.toISOString(),
        netProfit: profit,
        status: 'CLOSED'
      });
    }

    bots.push({
      id: strat.id,
      strategyName: strat.name,
      botType: strat.type,
      status: 'RUNNING',
      results: {
        deals: deals.sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime)), // newest first
        profit: currentNav - 30000000,
        return: ((currentNav - 30000000) / 30000000) * 100,
        numberOfWins: totalWins,
        numberOfLosses: totalLosses,
        numberOfSignals: totalWins + totalLosses,
        highestNav: highestNav,
        endNav: currentNav
      }
    });
  });

  return bots;
};
