import json
from deep_translator import GoogleTranslator

LANGS = ['ja', 'it', 'en']

def translate_missing_news(json_path='news.json'):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            news_list = json.load(f)
    except FileNotFoundError:
        print(f"Errore: File '{json_path}' non trovato nella root.")
        return

    updated = False

    for item in news_list:
        # Trova la prima lingua compilata presente nell'oggetto
        source_lang = None
        source_text = ""
        for lang in LANGS:
            if item.get(lang) and str(item[lang]).strip():
                source_lang = lang
                source_text = str(item[lang]).strip()
                break
        
        if not source_lang:
            continue

        # Traduci automaticamente le chiavi lingua mancanti o vuote
        for target_lang in LANGS:
            if not item.get(target_lang) or not str(item[target_lang]).strip():
                try:
                    translated = GoogleTranslator(source=source_lang, target=target_lang).translate(source_text)
                    item[target_lang] = translated
                    updated = True
                    print(f"[{item.get('id', 'news')}] Tradotto ({source_lang} -> {target_lang}): {translated}")
                except Exception as e:
                    print(f"Errore durante la traduzione verso ({target_lang}): {e}")

    if updated:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(news_list, f, ensure_ascii=False, indent=2)
        print("\nnews.json aggiornato con successo!")
    else:
        print("Tutte le notizie risultano già tradotte in tutte le lingue.")

if __name__ == '__main__':
    translate_missing_news('news.json')
