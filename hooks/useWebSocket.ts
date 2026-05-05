import { useEffect, useRef } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/ws` 
  : "http://localhost:8080/ws";

export function useWebSocket(topic: string, onMessage: (message: any) => void) {
  const clientRef = useRef<Client | null>(null);
  const onMessageRef = useRef(onMessage);

  // Keep the latest callback ref to avoid reconnecting when callback changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(SOCKET_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str) => {
        console.log(`[STOMP] ${str}`);
      },
    });

    client.onConnect = () => {
      console.log(`[STOMP] Successfully connected! Subscribing to ${topic}...`);
      client.subscribe(topic, (message: IMessage) => {
        console.log(`[STOMP] Received message on ${topic}:`, message.body);
        if (message.body) {
          try {
            const parsedMessage = JSON.parse(message.body);
            onMessageRef.current(parsedMessage);
          } catch (error) {
            console.error("Failed to parse STOMP message", error);
          }
        }
      });
    };

    client.onStompError = (frame) => {
      console.error("Broker reported error: " + frame.headers["message"]);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [topic]);

  return clientRef;
}
