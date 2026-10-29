import os
import json
from deep_translator import GoogleTranslator

LANGS = ['ja', 'it', 'en']

def translate_missing_news():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(script_dir, '..'))
    json_path = os.path.join(root_dir, 'news.json')

    print(f"--- Lettura file: {json_path} ---")

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            news_list = json.load(f)
    except Exception as e:
        print(f"Errore durante il caricamento del file JSON: {e}")
        return

    updated = False

    for item in news_list:
        news_id = item.get('id', 'unknown')
        
        # Individua la prima lingua compilata
        source_lang = None
        source_text = ""
        for lang in LANGS:
            val = item.get(lang)
            if val and str(val).strip():
                source_lang = lang
                source_text = str(val).strip()
                break
        
        if not source_lang:
            print(f"[{news_id}] Nessun testo presente, salto.")
            continue

        # Traduci le lingue mancanti o vuote
        for target_lang in LANGS:
            target_val = item.get(target_lang)
            if not target_val or not str(target_val).strip():
                print(f"[{news_id}] Traduzione in corso ({source_lang} -> {target_lang}): '{source_text}'")
                try:
                    translated = GoogleTranslator(source=source_lang, target=target_lang).translate(source_text)
                    if translated:
                        item[target_lang] = translated
                        updated = True
                        print(f"[{news_id}] -> RISULTATO ({target_lang}): {translated}")
                except Exception as e:
                    print(f"[{news_id}] -> ERRORE TRADUZIONE ({target_lang}): {e}")

    if updated:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(news_list, f, ensure_ascii=False, indent=2)
        print("--- SUCCESSO: news.json aggiornato e salvato su disco ---")
    else:
        print("--- INFO: Nessuna traduzione necessaria (tutte le notizie risultano già complete) ---")

if __name__ == '__main__':
    translate_missing_news()
