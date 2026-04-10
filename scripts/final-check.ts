import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

async function checkFinalStatus() {
  const email = "vigianiallan@gmail.com";
  try {
    const q = query(collection(db, 'nutritionists'), where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log("Usuário não encontrado.");
      return;
    }

    const userData = snapshot.docs[0].data();
    console.log(`Plano atual: ${userData.plan}`);
    console.log(`Status da Assinatura: ${userData.subscriptionStatus}`);
    console.log(`ID da Assinatura: ${userData.subscriptionId}`);
    
    if (userData.plan === 'premium') {
      console.log("✅ SUCESSO! O webhook funcionou e seu plano agora é PREMIUM.");
    } else {
      console.log("❌ O plano ainda é FREE. O webhook pode não ter sido enviado ou houve um erro no processamento.");
    }
  } catch (error) {
    console.error("Erro ao verificar status:", error);
  }
}

checkFinalStatus();
