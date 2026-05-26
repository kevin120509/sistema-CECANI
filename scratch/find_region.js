const dns = require('dns');

dns.resolveMx('cvbvzseaokobbyawkbzf.supabase.co', (err, addresses) => {
  console.log('MX addresses:', addresses);
});

dns.resolveAny('cvbvzseaokobbyawkbzf.supabase.co', (err, addresses) => {
  console.log('ANY addresses:', addresses);
});

dns.lookup('cvbvzseaokobbyawkbzf.supabase.co', (err, address, family) => {
  console.log('IP Address:', address);
});
