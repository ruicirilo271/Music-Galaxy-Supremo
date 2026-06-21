# Music Galaxy — Super Deus Supremo

Aplicação Flask completa:

- Pesquisa artista pelo iTunes.
- Mostra álbuns oficiais do artista.
- Clica num álbum e aparecem as faixas.
- Clica numa música e a app procura o vídeo no YouTube com `YOUTUBE_API_KEY`.
- Toca no player fixo no rodapé.
- Ouvir álbum inteiro.
- Shuffle do álbum.
- Fila de reprodução.
- Repeat off / all / one.
- Favoritos.
- Histórico.
- Playlists com localStorage.
- Exportar/importar playlists em JSON.
- Filtro de álbuns.
- Filtro de músicas.
- Drawer lateral com fila, letra opcional e vídeos encontrados.
- Letras opcionais via LRCLIB, quando disponíveis.
- Design Super Deus Supremo.
- Preparado para Vercel.

## Estrutura

```txt
api/index.py
app.py
templates/index.html
static/script.js
static/style.css
requirements.txt
vercel.json
.env.example
README.md
```

## Correr no PC

```bash
pip install -r requirements.txt
```

### Windows PowerShell

```powershell
$env:YOUTUBE_API_KEY="A_TUA_KEY_AQUI"
python app.py
```

### CMD

```cmd
set YOUTUBE_API_KEY=A_TUA_KEY_AQUI
python app.py
```

Depois abre:

```txt
http://127.0.0.1:5000
```

## Publicar no Vercel

No Vercel, adiciona a variável:

```txt
YOUTUBE_API_KEY=A_TUA_KEY_AQUI
```

Opcional:

```txt
ITUNES_COUNTRY=PT
REQUEST_TIMEOUT=12
```

Depois faz redeploy.

## Criar a API Key

1. Entra no Google Cloud Console.
2. Cria ou escolhe um projeto.
3. Ativa **YouTube Data API v3**.
4. Vai a **Credentials**.
5. Cria uma **API key**.
6. Usa essa key como `YOUTUBE_API_KEY`.

## Nota importante

Esta app não baixa músicas do YouTube. Ela usa a API para encontrar vídeos e o player oficial embutido para tocar.
