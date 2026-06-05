from .models import Post


def score_post(post: Post, keywords: list[str]) -> tuple[float, list[str]]:
    text_lower = post.text.lower()
    total_score = 0.0
    matched: list[str] = []

    for keyword in keywords:
        kw_lower = keyword.lower()
        count = text_lower.count(kw_lower)
        if count > 0:
            # Multi-word keywords are more specific → higher weight per match.
            weight = len(keyword.split())
            total_score += count * weight
            matched.append(keyword)

    return total_score, matched


def score_posts(posts: list[Post], keywords: list[str]) -> list[Post]:
    for post in posts:
        post.score, post.matched_keywords = score_post(post, keywords)
    return sorted(posts, key=lambda p: p.score, reverse=True)
