import json
import re
import os

def load_json(path):
    try:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading {path}: {e}")
    return {} if "matches" not in path and "players" not in path else []

def build_static_matches_html():
    matches = load_json('matches.json')
    locations = load_json('locations.json')
    opponents = load_json('opponents.json')

    if not matches:
        return "", ""

    upcoming = [m for m in matches if m.get('status') == 'upcoming']
    past = [m for m in matches if m.get('status') in ['past', 'live']]
    
    upcoming.sort(key=lambda x: x.get('date', ''))
    past.sort(key=lambda x: x.get('date', ''), reverse=True)

    def get_opp_info(m):
        opp_id = m.get('opponent_id')
        opp = opponents.get(opp_id, {}) if isinstance(opponents, dict) else {}
        name = opp.get('name', {}).get('ja') if isinstance(opp.get('name'), dict) else m.get('team2Name', 'Opponent')
        logo = opp.get('logo') or m.get('team2Logo') or './immagini/logo.png'
        return name, logo

    def get_loc_info(loc_id, venue_fallback):
        loc = locations.get(loc_id, {}) if isinstance(locations, dict) else {}
        name = loc.get('ja') or venue_fallback or '-'
        url = loc.get('url') or loc.get('maps') or f"https://www.google.com/maps/search/?api=1&query={name}"
        return name, url

    # 1. Hero Next Match HTML
    upcoming_html = ""
    if upcoming:
        next_m = upcoming[0]
        opp_name, opp_logo = get_opp_info(next_m)
        loc_name, loc_url = get_loc_info(next_m.get('location_id'), next_m.get('venue'))
        is_home = next_m.get('isHome', True)
        
        t1_name = "Yokohama Calcio" if is_home else opp_name
        t1_logo = "./immagini/logo.png" if is_home else opp_logo
        t2_name = opp_name if is_home else "Yokohama Calcio"
        t2_logo = opp_logo if is_home else "./immagini/logo.png"
        date_str = next_m.get('date', '')
        time_str = f"{next_m.get('time')} K.O." if next_m.get('time') else ''

        upcoming_html = f'''
        <div class="upcoming-item match-detail-card next-match-hero" data-match-category="{next_m.get('category', '')}" data-match-date="{date_str}">
            <div class="next-match-header">
                <span class="next-match-badge">次戦の予定</span>
                <span style="font-weight: 700; color: var(--primary-sky);">公式戦</span>
            </div>
            <div class="match-teams-wrapper">
                <div class="team-column">
                    <div class="hero-logo-wrap"><img src="{t1_logo}" alt="{t1_name}"></div>
                    <span title="{t1_name}">{t1_name}</span>
                </div>
                <div class="match-vs-center">VS</div>
                <div class="team-column">
                    <div class="hero-logo-wrap"><img src="{t2_logo}" alt="{t2_name}"></div>
                    <span title="{t2_name}">{t2_name}</span>
                </div>
            </div>
            <div class="next-match-info">
                <div class="next-match-info-item"><i class="fas fa-calendar-alt" style="color: var(--primary-sky);"></i><span>{date_str}</span></div>
                {f'<div class="next-match-info-item"><i class="fas fa-clock" style="color: var(--primary-sky);"></i><span>{time_str}</span></div>' if time_str else ''}
                <div class="next-match-info-item venue-item"><i class="fas fa-map-marker-alt" style="color: var(--primary-sky);"></i><a href="{loc_url}" target="_blank" rel="noopener"><span>{loc_name}</span></a></div>
            </div>
        </div>
        '''

    # 2. Primi 3 risultati passati HTML
    past_html = ""
    for m in past[:3]:
        opp_name, opp_logo = get_opp_info(m)
        is_home = m.get('isHome', True)

        t1_name = "Yokohama Calcio" if is_home else opp_name
        t1_logo = "./immagini/logo.png" if is_home else opp_logo
        t2_name = opp_name if is_home else "Yokohama Calcio"
        t2_logo = opp_logo if is_home else "./immagini/logo.png"
        score = m.get('score', '-')

        past_html += f'''
        <div class="match-detail-card match-past-item" id="{m.get('id', '')}" data-match-category="{m.get('category', '')}" data-match-date="{m.get('date', '')}">
            <div class="match-header-row">
                <span class="match-badge badge-official">公式戦</span>
                <span class="match-date-text"><i class="far fa-calendar-alt"></i> {m.get('date', '')}</span>
            </div>
            <div class="match-teams-wrapper">
                <div class="team-column">
                    <div class="card-logo-wrap"><img src="{t1_logo}" alt="{t1_name}"></div>
                    <span title="{t1_name}">{t1_name}</span>
                </div>
                <div class="match-vs-center score-past">{score}</div>
                <div class="team-column">
                    <div class="card-logo-wrap"><img src="{t2_logo}" alt="{t2_name}"></div>
                    <span title="{t2_name}">{t2_name}</span>
                </div>
            </div>
        </div>
        '''

    return upcoming_html, past_html

def inject_html_to_file(filename, upcoming_html, past_html):
    if not os.path.exists(filename):
        return
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()

        if upcoming_html:
            content = re.sub(
                r'(<div id="upcomingContainer"[^>]*>)(.*?)(</div>)',
                rf'\1\n{upcoming_html}\n\3',
                content,
                flags=re.DOTALL
            )
        if past_html:
            content = re.sub(
                r'(<div id="pastContainer"[^>]*>)(.*?)(</div>)',
                rf'\1\n{past_html}\n\3',
                content,
                flags=re.DOTALL
            )

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Static HTML injected into {filename}")
    except Exception as e:
        print(f"Error updating {filename}: {e}")

if __name__ == '__main__':
    upcoming_h, past_h = build_static_matches_html()
    inject_html_to_file('matches.html', upcoming_h, past_h)
    inject_html_to_file('index.html', upcoming_h, past_h)
    inject_html_to_file('players.html', upcoming_h, past_h)
    inject_html_to_file('stats.html', upcoming_h, past_h)
