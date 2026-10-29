import os
import json
import urllib.parse
import urllib.request
from deep_translator import GoogleTranslator

LANGS = ['ja', 'it', 'en']

def translate_text(text, source_lang, target_lang):
    # Motore 1: deep-translator (Google)
    try:
        translated = GoogleTranslator(source='auto', target=target_lang).translate(text)
        if translated and str(translated).strip():
            return str(translated).strip()
    except Exception as e:
        print(f"  [Avviso] GoogleTranslator non disponibile ({e}). Passo al motore di riserva...")

    # Motore 2: Fallback MyMemory API (gratuito)
    try:
        url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(text)}&langpair={source_lang}|{target_lang}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            res = data.get('responseData', {}).get('translatedText')
            if res and str(res).strip():
                return str(res).strip()
    except Exception as e:
        print(f"  [Errore] Anche il fallback MyMemory è fallito: {e}")

    return None

def translate_missing_news():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(script_dir, '..'))
    json_path = os.path.join(root_dir, 'news.json')

    print(f"=== Lettura file: {json_path} ===")

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            news_list = json.load(f)
    except Exception as e:
        print(f"Errore caricamento news.json: {e}")
        return

    updated_count = 0

    for item in news_list:
        news_id = item.get('id', 'unknown')
        
        # Individua la prima lingua con testo valido
        source_lang = None
        source_text = ""
        for lang in LANGS:
            if item.get(lang) and str(item[lang]).strip():
                source_lang = lang
                source_text = str(item[lang]).strip()
                break
        
        if not source_lang:
            continue

        # Genera le lingue mancanti o vuote
        for target_lang in LANGS:
            if target_lang == source_lang:
                continue

            current_val = item.get(target_lang)
            if not current_val or not str(current_val).strip():
                print(f"[{news_id}] Traduzione {source_lang} -> {target_lang}: '{source_text}'")
                translated = translate_text(source_text, source_lang, target_lang)
                if translated:
                    item[target_lang] = translated
                    updated_count += 1
                    print(f"[{news_id}] -> RISULTATO ({target_lang}): '{translated}'")

    if updated_count > 0:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(news_list, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f"=== SUCCESSO: {updated_count} traduzioni salvate in news.json ===")
    else:
        print("=== INFO: Nessuna traduzione necessaria ===")

if __name__ == '__main__':
    translate_missing_news()
