const subscribers = new Map();

const getSubscriberSet = (appointmentId) => {
  if (!subscribers.has(appointmentId)) {
    subscribers.set(appointmentId, new Set());
  }
  return subscribers.get(appointmentId);
};

const formatEvent = ({ event, data }) => {
  const payload = JSON.stringify(data ?? {});
  return `event: ${event}\ndata: ${payload}\n\n`;
};

export const subscribeToAppointmentStream = (appointmentId, response) => {
  const streamSet = getSubscriberSet(appointmentId);
  streamSet.add(response);

  return () => {
    const set = subscribers.get(appointmentId);
    if (!set) return;
    set.delete(response);
    if (!set.size) subscribers.delete(appointmentId);
  };
};

export const broadcastAppointmentEvent = (appointmentId, event, data) => {
  const streamSet = subscribers.get(appointmentId);
  if (!streamSet || !streamSet.size) return;

  const message = formatEvent({ event, data });
  for (const subscriber of streamSet) {
    try {
      subscriber.write(message);
    } catch {
      // Ignore closed stream writes; cleanup happens on close handler.
    }
  }
};

