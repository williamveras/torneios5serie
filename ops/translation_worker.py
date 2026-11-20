"""Private, bounded Argos translation queue. No HTTP service or external text API."""
import base64
import collections
import fcntl
import html
import json
import os
import re
import subprocess
import sys

os.environ.update(ARGOS_DEVICE_TYPE="cpu", OMP_NUM_THREADS="1", ARGOS_INTER_THREADS="1", ARGOS_INTRA_THREADS="1")

def literal(value):
    encoded = base64.b64encode(str(value).encode()).decode()
    return "convert_from(decode('%s','base64'),'UTF8')" % encoded

def sql(statement):
    database = os.environ.get("TRANSLATION_DATABASE", "postgres")
    if database not in ("postgres", "torneios_safety_test"):
        raise ValueError("Unexpected database")
    result = subprocess.run(["docker", "exec", "-i", "supabase-db", "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], input=statement, text=True, capture_output=True, timeout=20, check=True)
    return result.stdout.strip()

def translate_text(source, language):
    import argostranslate.translate
    if language not in ("en", "es", "fr") or len(source) > 100000:
        raise ValueError("Unsupported translation")
    number_words = {
        "pt": dict(zip("zero dois duas três quatro cinco seis sete oito nove dez".split(), "0 2 2 3 4 5 6 7 8 9 10".split())),
        "en": dict(zip("zero two three four five six seven eight nine ten".split(), "0 2 3 4 5 6 7 8 9 10".split())),
        "es": dict(zip("cero dos tres cuatro cinco seis siete ocho nueve diez".split(), "0 2 3 4 5 6 7 8 9 10".split())),
        "fr": dict(zip("zéro deux trois quatre cinq six sept huit neuf dix".split(), "0 2 3 4 5 6 7 8 9 10".split())),
    }
    ordinal_words = {
        "pt": ["um uma primeiro primeira", "segundo segunda", "terceiro terceira", "quarto quarta", "quinto quinta", "sexto sexta", "sétimo sétima", "oitavo oitava", "nono nona", "décimo décima"],
        "en": ["one first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"],
        "es": ["uno una primer primero primera", "segundo segunda", "tercer tercero tercera", "cuarto cuarta", "quinto quinta", "sexto sexta", "séptimo séptima", "octavo octava", "noveno novena", "décimo décima"],
        "fr": ["un une premier première", "second seconde deuxième", "troisième", "quatrième", "cinquième", "sixième", "septième", "huitième", "neuvième", "dixième"],
    }
    for locale, groups in ordinal_words.items():
        for value, group in enumerate(groups, 1):
            number_words[locale].update({word: str(value) for word in group.split()})

    def numeric_equal(original, translated):
        def digits(text):
            return collections.Counter(str(int(value)) for value in re.findall(r"\d+", text))
        def spelled(text, locale):
            words = number_words[locale]
            return collections.Counter(words[word.lower()] for word in re.findall(r"\b(?:" + "|".join(words) + r")\b", text, flags=re.I))
        before, after = digits(original), digits(translated)
        # Compare literal values, allowing equivalent words (3 -> three, terceiro -> 3rd).
        # Do not count Portuguese "dos" as the Spanish number two, or force prose
        # words such as weekday names to be translated as numbers.
        return not ((before - after) - spelled(translated, language)) and not ((after - before) - spelled(original, "pt"))
    def run_model(text):
        def decode(value):
            # Some French model outputs encode a nonbreaking space as "& #160;".
            # Decode entities before comparing numbers or feeding the pivot model.
            value = re.sub(r"&\s*#\s*(\d+)\s*;", r"&#\1;", value)
            return html.unescape(value)
        translated = decode(argostranslate.translate.translate(text, "pt", "en"))
        return decode(argostranslate.translate.translate(translated, "en", language)) if language != "en" else translated

    def keep_numeric_segments(text):
        source_words = "zero|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez"
        numeric = r"\d+(?:[.,:/-]\d+)*|\b(?:" + source_words + r")\b"
        pieces = re.split("(" + numeric + ")", text, flags=re.I)
        output = []
        for piece in pieces:
            if not piece or re.fullmatch(numeric, piece, flags=re.I) or not re.search(r"[a-zA-ZÀ-ÿ]", piece):
                output.append(number_words["pt"].get(piece.lower(), piece))
            else:
                left = piece[:len(piece)-len(piece.lstrip())]
                right = piece[len(piece.rstrip()):]
                translated = run_model(piece.strip()).strip()
                if not piece.rstrip().endswith((".", "!", "?")):
                    translated = translated.rstrip(".")
                output.append(left + translated + right)
        return "".join(output)

    # Keep links, email addresses, identifiers and all line breaks unchanged.
    protected = r"(https?://[^\s]+|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|\r?\n)"
    result = []
    for part in re.split(protected, source):
        if not part or re.fullmatch(protected, part) or not re.search(r"[a-zA-ZÀ-ÿ]", part):
            result.append(part)
            continue
        chunks = re.findall(r".{1,1000}(?:\s+|$)|\S{1,1000}", part)
        for chunk in chunks:
            leading = chunk[:len(chunk) - len(chunk.lstrip())]
            trailing = chunk[len(chunk.rstrip()):]
            translated = run_model(chunk.strip())
            if not numeric_equal(chunk, translated):
                translated = keep_numeric_segments(chunk.strip())
            if not translated.strip():
                raise ValueError("Empty translation")
            result.append(leading + translated.strip() + trailing)
    translated = "".join(result)
    # Never silently change points, dates or participant counts.
    # Models sometimes spell out digits ("3" -> "three"). Compare their values.
    if not numeric_equal(source, translated):
        raise ValueError("Numeric content changed; manual review required")
    return translated

def run_queue():
    with open("/run/torneios-translations.lock", "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        rows = json.loads(sql("SELECT coalesce(jsonb_agg(t),'[]') FROM (SELECT * FROM tournament_security.translations WHERE status IN ('pending','failed') AND attempts<3 AND next_attempt<=now() ORDER BY (kind='rules') DESC,updated_at LIMIT 1) t;"))
        for row in rows:
            condition = " AND ".join(key + "=" + literal(row[key]) + ("::uuid" if key in ("tournament_id", "source_id") else "") for key in ("tournament_id", "kind", "source_id", "language", "source_hash"))
            condition += " AND NOT reviewed AND status IN ('pending','failed')"
            try:
                cached = sql("SELECT to_json(translated_text) FROM tournament_security.translations WHERE status='ready' AND NOT reviewed AND language=" + literal(row["language"]) + " AND source_hash=" + literal(row["source_hash"]) + " AND source_text=" + literal(row["source_text"]) + " LIMIT 1;")
                if cached:
                    output = json.loads(cached)
                else:
                    process = subprocess.run([sys.executable, __file__, "--translate", row["language"]], input=row["source_text"], text=True, capture_output=True, timeout=360, check=True)
                    output = json.loads(process.stdout)
                sql("UPDATE tournament_security.translations SET translated_text=" + literal(output) + ",status='ready',updated_at=now() WHERE " + condition + ";")
                print("Translation completed", row["kind"], row["language"], flush=True)
            except (subprocess.SubprocessError, ValueError) as error:
                sql("UPDATE tournament_security.translations SET status='failed',attempts=attempts+1,next_attempt=now()+interval '10 minutes',updated_at=now() WHERE " + condition + ";")
                reason = type(error).__name__
                if isinstance(error, subprocess.CalledProcessError) and error.stderr:
                    reason += ": " + error.stderr.strip().splitlines()[-1][:160]
                print("Translation deferred for retry or organizer review", row["kind"], row["language"], reason, flush=True)

if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--translate":
        print(json.dumps(translate_text(sys.stdin.read(), sys.argv[2]), ensure_ascii=False))
    else:
        run_queue()
