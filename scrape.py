#!/usr/bin/env python3
"""
Scrape LinkedIn feed from the command line.

Usage:
    python scrape.py [options]

Examples:
    python scrape.py
    python scrape.py --attempts 1 --keywords "QA,pytest,automatisation"
    python scrape.py --min-score 2 --json
    python scrape.py --no-save
"""
import argparse
import json
import logging
import sys
from datetime import datetime, timezone

from app.config import get_settings
from app.cookies import load_cookies
from app.scorer import score_posts
from app.scraper import AuthenticationError, LinkedInScraper
from app.storage import PostStorage


def parse_args():
    p = argparse.ArgumentParser(description="Scrape LinkedIn feed")
    p.add_argument(
        "--attempts", "-a",
        type=int,
        default=None,
        help="Number of scroll attempts (default: MAX_SCROLL_ATTEMPTS from config)",
    )
    p.add_argument(
        "--keywords", "-k",
        type=str,
        default=None,
        help="Comma-separated keywords, e.g. 'QA,pytest,automatisation' (default: from config)",
    )
    p.add_argument(
        "--min-score", "-s",
        type=float,
        default=0.0,
        help="Only show posts with score >= this value (default: 0, shows all)",
    )
    p.add_argument(
        "--no-save",
        action="store_true",
        help="Don't persist results to posts.json",
    )
    p.add_argument(
        "--json",
        action="store_true",
        dest="output_json",
        help="Output results as JSON instead of a readable table",
    )
    p.add_argument(
        "--cookies", "-c",
        type=str,
        default=None,
        help="Path to cookies JSON file (default: from config)",
    )
    p.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show debug logs",
    )
    return p.parse_args()


def print_table(posts, keywords):
    sep = "─" * 80
    for i, p in enumerate(posts, 1):
        print(sep)
        print(f"[{i}] {p.author}  •  réactions: {p.reactions}  •  score: {p.score:.1f}")
        if p.matched_keywords:
            print(f"    Mots-clés: {', '.join(p.matched_keywords)}")
        if p.url:
            print(f"    URL: {p.url}")
        # Wrap text at 76 chars
        words = p.text.split()
        line, lines = [], []
        for w in words:
            if sum(len(x) + 1 for x in line) + len(w) > 76:
                lines.append(" ".join(line))
                line = [w]
            else:
                line.append(w)
        if line:
            lines.append(" ".join(line))
        for l in lines[:8]:
            print(f"    {l}")
        if len(lines) > 8:
            print(f"    … ({len(lines) - 8} lignes de plus)")
    if posts:
        print(sep)


def main():
    args = parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    settings = get_settings()

    cookies_file = args.cookies or settings.cookies_file
    keywords = (
        [k.strip() for k in args.keywords.split(",") if k.strip()]
        if args.keywords
        else settings.interest_keywords
    )
    attempts = args.attempts or settings.max_scroll_attempts

    print(f"Cookies : {cookies_file}")
    print(f"Mots-clés : {', '.join(keywords)}")
    print(f"Passes : {attempts}")
    print()

    # Load cookies early so we fail fast on missing file
    try:
        load_cookies(cookies_file)
    except FileNotFoundError:
        print(f"Erreur : fichier cookies introuvable : {cookies_file}", file=sys.stderr)
        sys.exit(1)

    scraper = LinkedInScraper(settings)
    # Override cookies path if provided
    if args.cookies:
        scraper._settings = settings.model_copy(update={"cookies_file": args.cookies})

    print("Scraping en cours…", flush=True)
    try:
        posts = scraper.scrape(scroll_attempts=attempts)
    except AuthenticationError as e:
        print(f"\nEchec d'authentification : {e}", file=sys.stderr)
        print("→ Ré-exportez vos cookies via l'extension Cookie Editor.", file=sys.stderr)
        sys.exit(1)

    if not posts:
        print("Aucun post trouvé.")
        sys.exit(0)

    scored = score_posts(posts, keywords)
    filtered = [p for p in scored if p.score >= args.min_score]

    print(f"{len(posts)} posts scraped  •  {len(filtered)} affichés (min-score={args.min_score})\n")

    if not args.no_save:
        storage = PostStorage(settings.posts_file)
        new_count = storage.upsert_posts(scored)
        print(f"Sauvegardé dans {settings.posts_file}  (+{new_count} nouveaux)\n")

    if args.output_json:
        print(json.dumps(
            [p.model_dump(mode="json") for p in filtered],
            indent=2,
            ensure_ascii=False,
        ))
    else:
        print_table(filtered, keywords)


if __name__ == "__main__":
    main()
