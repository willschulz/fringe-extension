# Pilot search API

The extension uses one versioned endpoint:

```text
POST https://willschulz.com/demoscope-api/v1/search
Authorization: Bearer <pilot token>
Content-Type: application/json
```

## Request

```json
{
  "text": "A bounded public-post text string",
  "k": 3,
  "min_n": 500
}
```

Constraints:

- `text`: required, trimmed, 1–500 characters;
- `k`: integer from 1–5; and
- `min_n`: integer from 0–100000.

## Successful response

```json
{
  "hits": [
    {
      "rank": 1,
      "source": "pew",
      "source_label": "Pew Research Center",
      "variable": "EXAMPLE_W1",
      "q_text": "Example survey question?",
      "options": ["Yes", "No"],
      "year_min": 2024,
      "year_max": 2024,
      "n": 5000,
      "embedding": 0.61
    }
  ],
  "weak_match": false,
  "bm25_only": false,
  "total": 1
}
```

Unknown response fields must be ignored. The extension must not reconstruct
links from internal corpus paths; those paths are deliberately absent.
The pilot currently searches Pew, ANES, GSS, and CES records. Knight/Gallup
records remain private pending a separate redistribution-permission review.

## Error responses

- `400` or `422`: invalid body;
- `401`: token missing or invalid;
- `405`: method not allowed;
- `413`: request too large;
- `429`: rate limit exceeded;
- `503`: search index unavailable; and
- `5xx`: transient service error.

The client may retry `429`, `503`, and other transient `5xx` responses with a
short bounded backoff. It must not retry authentication or validation errors.

## Display policy

The server owns weak-match calibration. The extension must suppress a response
when `weak_match` is true, when `bm25_only` is true, or when no hits are
returned. The client must not maintain an independent embedding threshold that
can drift from the server.
