# Pedido de auditoria da API do YouTube — respostas prontas

Formulário oficial: https://support.google.com/youtube/contact/yt_api_form
Opção a escolher: **"I want to request an audit of my API client"** (ou "Audit and Quota Extension").
Motivo: projetos não auditados têm os vídeos enviados pela API travados como privados.

| Campo | Resposta |
|---|---|
| Name | Clayton Santos |
| Email | clayton.gestor07@gmail.com |
| Organization / Company | Quiz do Reino (YouTube channel) |
| Organization website | https://pequenos-sabios-512811.web.app/ |
| Google Cloud project number | 331922982119 |
| Google Cloud project ID | pequenos-sabios-512811 |
| API client name | Pequenos Sabios Publicador |
| OAuth client ID | 331922982119-6ruojgmsbg1arcp2kspgiqf238cd6nsa.apps.googleusercontent.com |
| YouTube channel | https://www.youtube.com/@PequenosSabiosQuiz (channel ID UCJ5-Z1oDZdchMwalFVXpLUg) |
| Privacy policy | https://pequenos-sabios-512811.web.app/privacidade.html |
| Terms of service | https://pequenos-sabios-512811.web.app/termos.html |
| APIs used | YouTube Data API v3 (videos.insert, thumbnails.set, videos.list, channels.list); YouTube Analytics API (reports.query) |
| Expected daily quota | Default 10,000 units/day is enough (≈3 uploads/day ≈ 4,950 units) |

## Description of the API client (English)

Pequenos Sabios Publicador is an internal, single-user command-line tool owned and operated by the owner of the YouTube channel "Quiz do Reino", a Christian educational channel for children aged 5–9 (channel set as Made for Kids).

The tool runs only on the channel owner's computer. It uploads videos that our team produces (original animated Bible quizzes) to our own channel, sets title, description, chapters, tags, the Made for Kids flag (selfDeclaredMadeForKids = true) and a scheduled publish time, uploads the custom thumbnail, and reads our own channel's video statistics to track performance.

It is not offered to any other user, has no public interface, and only accesses the single channel owned by the operator, authorized via OAuth by the channel owner. It does not access, collect or store any data about viewers, children or other YouTube users. The only stored data is the operator's own OAuth refresh token, kept locally with restricted file permissions. Statistics of our own videos are stored locally only to measure our own channel's performance and are not shared.

We request the audit so that videos uploaded through videos.insert can be published (currently they are locked as private because the project is unaudited), allowing our scheduled episodes to go public automatically at the scheduled time.

## How the client uses each API method

- **videos.insert**: upload our own produced episode or Short to our own channel, with privacyStatus "private" plus publishAt (scheduled publishing) and selfDeclaredMadeForKids = true.
- **thumbnails.set**: set the custom thumbnail of our own uploaded episode.
- **videos.list / channels.list**: read status and statistics (views, likes) of our own videos and confirm the authorized channel.
- **YouTube Analytics reports.query**: read aggregated performance reports of our own channel.

## Documentation to attach (if requested)

- Site with description, privacy policy and terms: https://pequenos-sabios-512811.web.app/
- Screenshots: the publisher running in the terminal and the YouTube Studio showing the uploaded, scheduled video (take after the first upload).
