const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const serviceAccount = require('./serviceAccount.json');

initializeApp({ credential: cert(serviceAccount) });

getMessaging().send({
  token: 'cNZ1kbXsK2498fmy1S5kgK:APA91bFLUMi9MWT-ZHLrs8R2GjWfC_3pZCd6qAhFolTDXZU-04080VRVt7EPLlzbznarKpRLuKcHLkx41bOF6b5KG21g2mgb-9Ido54dun6_RCAUWg551uU',
  notification: {
    title: '💸 DividApp',
    body: 'Pedro agregó un gasto de $15.000 en el Asado'
  }
}).then(r => console.log('✅ Push enviada:', r)).catch(e => console.error('❌ Error:', e));