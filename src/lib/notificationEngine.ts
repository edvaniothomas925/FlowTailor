import { localDb } from './neonStore';
import { Pedido } from '../types';

export interface PushNotificationAlert {
  id: string;
  orderId: string;
  orderDesc: string;
  clientNome: string;
  clientTelefone: string;
  daysRemaining: number;
  message: string;
  whatsappUrl: string;
  sentAt: string;
  read: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  lastScannedAt: string | null;
  whatsappTemplate?: string;
}

// Play offline-friendly synthesizer chime
export function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Play a dual-tone warm notification wave
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // C5 -> A5
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc2.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.12); // E5 -> C6
    
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);
    osc2.stop(ctx.currentTime + 0.4);
  } catch (err) {
    console.warn('Audio synthesis blocked or not supported yet:', err);
  }
}

export const DEFAULT_WHATSAPP_TEMPLATE = `Olá, {clienteNome}! 😊 Passando para lembrar que a sua encomenda no AteliêPro ("{descricao}") está agendada para ser entregue no dia {prazoEntrega}. Estamos a dar as últimas costuras e os pormenores finais! Aguardamos o seu feedback ou visita para a prova de roupa. Beijos! 🪡✨`;

export function formatWhatsAppMessage(template: string, clienteNome: string, descricao: string, prazoEntrega: string): string {
  const formattedDate = new Date(prazoEntrega).toLocaleDateString('pt-AO');
  return template
    .replace(/{clienteNome}/g, clienteNome)
    .replace(/{descricao}/g, descricao)
    .replace(/{prazoEntrega}/g, formattedDate);
}

// Generate friendly click-to-chat text for WhatsApp
export function generateWhatsAppText(clienteNome: string, descricao: string, prazoEntrega: string, atelieId?: string) {
  let template = DEFAULT_WHATSAPP_TEMPLATE;
  if (atelieId) {
    const settings = getNotificationSettings(atelieId);
    if (settings && settings.whatsappTemplate && settings.whatsappTemplate.trim()) {
      template = settings.whatsappTemplate;
    }
  }
  return formatWhatsAppMessage(template, clienteNome, descricao, prazoEntrega);
}

// Clean and build WhatsApp URL for Angolan mobile numbers
export function buildWhatsAppUrl(telefone: string, message: string) {
  let cleanPhone = telefone.replace(/\D/g, '');
  
  // Angola Country Code formatting fallback
  if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
    cleanPhone = '244' + cleanPhone;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// Fetch notification config
export function getNotificationSettings(atelieId: string): NotificationSettings {
  const key = `ateliepro_notif_config_${atelieId}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback
    }
  }
  return {
    enabled: true,
    soundEnabled: true,
    lastScannedAt: null,
  };
}

// Save notification config
export function saveNotificationSettings(atelieId: string, settings: NotificationSettings) {
  const key = `ateliepro_notif_config_${atelieId}`;
  localStorage.setItem(key, JSON.stringify(settings));
}

// Get history of alerts for an Atelie
export function getAlertsHistory(atelieId: string): PushNotificationAlert[] {
  const key = `ateliepro_notifs_history_${atelieId}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback
    }
  }
  return [];
}

// Save history of alerts
export function saveAlertsHistory(atelieId: string, alerts: PushNotificationAlert[]) {
  const key = `ateliepro_notifs_history_${atelieId}`;
  localStorage.setItem(key, JSON.stringify(alerts));
}

// Core scan engine to fetch expiring orders
export function scanExpiringOrders(
  atelieId: string,
  onNewAlert: (alert: PushNotificationAlert) => void,
  forceAll: boolean = false
): PushNotificationAlert[] {
  const settings = getNotificationSettings(atelieId);
  if (!settings.enabled && !forceAll) {
    return [];
  }

  const pedidos = localDb.getPedidos(atelieId);
  const now = new Date();
  const todayString = now.toISOString().split('T')[0];
  
  // Reset hour, min, sec for date accuracy comparisons
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const generatedAlerts: PushNotificationAlert[] = [];
  const history = getAlertsHistory(atelieId);

  // Filter Active orders (em_andamento or aguardando_prova)
  const activeOrders = pedidos.filter(p => p.status === 'em_andamento' || p.status === 'aguardando_prova');

  activeOrders.forEach(pedido => {
    if (!pedido.prazoEntrega) return;

    const deadline = new Date(pedido.prazoEntrega);
    const deadlineMidnight = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    
    // Calculates differences in days
    const diffTime = deadlineMidnight.getTime() - todayMidnight.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // TARGET: Exactly 2 days to expire / delivery (diffDays === 2)
    if (diffDays === 2) {
      // Prevent duplicating fired alerts for the same order on the same day unless forced
      const firedKey = `ateliepro_fired_${atelieId}_${pedido.id}_${todayString}`;
      const alreadyFiredToday = localStorage.getItem(firedKey) === 'true';

      if (!alreadyFiredToday || forceAll) {
        // Record it as fired
        localStorage.setItem(firedKey, 'true');

        const messageText = `Atenção Costureira: A encomenda de ${pedido.clienteNome} ("${pedido.descricao}") está a 2 dias de expirar!`;
        const waMsg = generateWhatsAppText(pedido.clienteNome, pedido.descricao, pedido.prazoEntrega, atelieId);
        const waUrl = buildWhatsAppUrl(pedido.clienteTelefone, waMsg);

        const newAlert: PushNotificationAlert = {
          id: `alert_${Date.now()}_${pedido.id}`,
          orderId: pedido.id,
          orderDesc: pedido.descricao,
          clientNome: pedido.clienteNome,
          clientTelefone: pedido.clienteTelefone,
          daysRemaining: 2,
          message: messageText,
          whatsappUrl: waUrl,
          sentAt: new Date().toISOString(),
          read: false,
        };

        // Prepend to history, keeping max 30 logs
        const updatedHistory = [newAlert, ...history].slice(0, 30);
        saveAlertsHistory(atelieId, updatedHistory);
        
        // Trigger browser native Push notification
        triggerNativeNotification(pedido.clienteNome, pedido.descricao, waUrl);

        if (settings.soundEnabled) {
          playNotificationChime();
        }

        onNewAlert(newAlert);
        generatedAlerts.push(newAlert);
      }
    }
  });

  // Update last scanned timestamp
  settings.lastScannedAt = new Date().toISOString();
  saveNotificationSettings(atelieId, settings);

  return generatedAlerts;
}

// Request permission and fire HTML5 standard browser notifications safely
export function triggerNativeNotification(clienteNome: string, orderDesc: string, targetUrl: string) {
  try {
    if (!('Notification' in window)) return;
    
    let permission = 'default';
    try {
      permission = Notification.permission;
    } catch (e) {
      console.warn('Blocked reading Notification.permission from sandboxed iframe:', e);
      return;
    }

    if (permission === 'granted') {
      const notif = new Notification('⚠️ Encomenda a vencer em 2 dias!', {
        body: `Costureira: A encomenda de ${clienteNome} ("${orderDesc}") expira em 2 dias. Clique para gerar mensagem de WhatsApp.`,
        icon: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=120',
        tag: `order_expiry_notif_${clienteNome}`,
        requireInteraction: true
      });

      notif.onclick = (e) => {
        e.preventDefault();
        try {
          window.open(targetUrl, '_blank', 'noreferrer,noopener');
        } catch (openErr) {
          console.warn('Failed to open WhatsApp URL from notification click inside iframe:', openErr);
        }
      };
    }
  } catch (err) {
    console.warn('Native browser notification delivery failed inside Sandbox iframe wrapper:', err);
  }
}

// Function to simulate a test push notification instantly for testing
export function simulateTestNotification(atelieId: string, onNewAlert: (alert: PushNotificationAlert) => void): PushNotificationAlert {
  const key = `ateliepro_notif_config_${atelieId}`;
  const settings = getNotificationSettings(atelieId);

  // Generate mock expiring order payload
  const mockOrder = {
    id: `mock_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now().toString(36)}`,
    clienteNome: 'Mariana Gungue',
    clienteTelefone: '+244923456789',
    descricao: 'Vestido de Gala com Renda Africana'
  };

  const messageText = `Teste Push: A encomenda de Mariana Gungue ("${mockOrder.descricao}") está a 2 dias de expirar!`;
  const mockDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const waMsg = generateWhatsAppText(mockOrder.clienteNome, mockOrder.descricao, mockDeadline, atelieId);
  const waUrl = buildWhatsAppUrl(mockOrder.clienteTelefone, waMsg);

  const testAlert: PushNotificationAlert = {
    id: `alert_test_${Date.now()}`,
    orderId: mockOrder.id,
    orderDesc: mockOrder.descricao,
    clientNome: mockOrder.clienteNome,
    clientTelefone: mockOrder.clienteTelefone,
    daysRemaining: 2,
    message: messageText,
    whatsappUrl: waUrl,
    sentAt: new Date().toISOString(),
    read: false,
  };

  const history = getAlertsHistory(atelieId);
  const updatedHistory = [testAlert, ...history].slice(0, 30);
  saveAlertsHistory(atelieId, updatedHistory);

  if (settings.soundEnabled) {
    playNotificationChime();
  }

  // Native notification fire test
  triggerNativeNotification(mockOrder.clienteNome, mockOrder.descricao, waUrl);

  onNewAlert(testAlert);
  return testAlert;
}
