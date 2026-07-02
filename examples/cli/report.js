// Example micromongo script — run with:  micromongo --file report.js --load ./orders.json:orders
// `db`, `mm`, print() are in scope (same sandbox as the interactive shell).

db.orders.createIndex({ qty: 1 });

var top = db.orders.find({ qty: { $gte: 50 } }).sort({ qty: -1 }).toArray();
print('Top orders by qty (>= 50):');
top.forEach(function (o) { print('  ' + o.item + ' — ' + o.qty); });

var byStatus = db.orders.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$qty' } } },
  { $sort: { _id: 1 } },
]);
print('\nBy status:');
byStatus.forEach(function (g) { print('  ' + g._id + ': ' + g.count + ' orders, ' + g.total + ' total qty'); });
