# ZYNX

ZYNX ist ein futuristisches 3D-Multiplayer-Roboter-Sammelspiel für Browser, Tablet und Smartphone.

## Geplanter Umfang

- Begehbare 3D-Welt mit Safe Zone und Seltenheitszonen
- Eier mit 60-Sekunden-Despawn und Wächterverfolgung
- Inventar mit zehn Plätzen, Basen, Robotern und passivem Einkommen
- Speed Shop, Laufband, Rebirth und Index
- Multiplayer-Räume mit Join-Codes
- Jeder Spieler kann einen Raum erstellen und den Code mit Freunden teilen
- Der Admin kann jeden Raum ohne Code betreten
- Admin: Eier in jeder Zone spawnen, Live-Nachrichten, Geld/Eier/Roboter geben, Spieler in Räume bringen und bannen
- Supabase Auth, Postgres, RLS, Realtime und serverseitig validierte Edge Functions

## Entwicklung

```bash
npx serve .
```

Die Anwendung ist für GitHub Pages vorgesehen. Geheime Supabase-Schlüssel dürfen niemals im Frontend gespeichert werden.
