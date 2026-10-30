export function getMonitoringMetrics({store, workerQueue} = {}) {
 const mem = process.memoryUsage();
 const metrics = {
  status: 'healthy',
  timestamp: Date.now(),
  uptime: Math.round(process.uptime()),
  memory: {
   rssMb: Math.round(mem.rss / (1024 * 1024)),
   heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
   heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024))
  },
  database: {
   users: store ? store.countUsers() : 0
  },
  queue: workerQueue ? workerQueue.getMetrics() : null
 };

 return metrics;
}
