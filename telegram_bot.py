"""
Bot Telegram personnel pour piloter Claude Code depuis SSH.

Fonctionnalités :
  /start    — accueil
  /usage    — stats de tokens Claude Code (tous projets)
  /mcp      — liste les serveurs MCP et permet d'appeler leurs outils
  /posts    — posts LinkedIn intéressants (raccourci)
  /scrape   — déclenche un scrape LinkedIn (raccourci)
  /help     — aide

Sécurité : seul TELEGRAM_USER_ID peut interagir avec le bot.
"""
import asyncio
import json
import logging
import os
from functools import wraps
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
)
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

load_dotenv()

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
AUTHORIZED_USER_ID = int(os.environ["TELEGRAM_USER_ID"])

PROJECT_DIR = Path(__file__).parent

# ConversationHandler states
MCP_CHOOSE_SERVER = 0
MCP_CHOOSE_TOOL = 1
MCP_COLLECT_ARGS = 2

# ──────────────────────────────────────────────────────────────────────── auth

def auth_required(handler):
    """Silently ignore messages from unauthorised users."""
    @wraps(handler)
    async def wrapper(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if user is None or user.id != AUTHORIZED_USER_ID:
            return
        return await handler(update, ctx)
    return wrapper


def auth_required_query(handler):
    """Same guard for CallbackQuery handlers."""
    @wraps(handler)
    async def wrapper(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if user is None or user.id != AUTHORIZED_USER_ID:
            return
        return await handler(update, ctx)
    return wrapper

# ──────────────────────────────────────────────────────────────────────── helpers

def _truncate(text: str, limit: int = 4000) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 20] + "\n\n_[tronqué…]_"


def _escape_md(text: str) -> str:
    """Minimal escape for Telegram MarkdownV2 special chars in plain values."""
    for ch in r"\_*[]()~`>#+-=|{}.!":
        text = text.replace(ch, f"\\{ch}")
    return text


def _format_posts(posts: list[dict], page: int = 0, page_size: int = 5) -> tuple[str, InlineKeyboardMarkup | None]:
    if not posts:
        return "Aucun post trouvé.", None

    total_pages = (len(posts) + page_size - 1) // page_size
    chunk = posts[page * page_size: (page + 1) * page_size]

    lines = [f"📋 *Posts LinkedIn* — page {page + 1}/{total_pages}\n"]
    for i, p in enumerate(chunk, start=page * page_size + 1):
        author = p.get("author", "?")
        text = p.get("text", "")[:200].replace("\n", " ")
        score = p.get("score", 0)
        url = p.get("url", "")
        url_part = f" [↗]({url})" if url else ""
        lines.append(f"*{i}. {author}* (score: {score:.1f}){url_part}")
        lines.append(f"_{text}…_\n")

    buttons = []
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("← Préc", callback_data=f"posts_page:{page - 1}"))
    if page + 1 < total_pages:
        nav.append(InlineKeyboardButton("Suiv →", callback_data=f"posts_page:{page + 1}"))
    if nav:
        buttons.append(nav)

    keyboard = InlineKeyboardMarkup(buttons) if buttons else None
    return "\n".join(lines), keyboard


# ──────────────────────────────────────────────────────────────────────── commands

@auth_required
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = (
        "👋 *Bot Claude Code*\n\n"
        "Commandes disponibles :\n"
        "/usage — stats de tokens Claude Code\n"
        "/mcp — interagir avec les serveurs MCP\n"
        "/posts — posts LinkedIn intéressants\n"
        "/scrape — déclencher un scrape LinkedIn\n"
        "/help — cette aide"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)


@auth_required
async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await cmd_start(update, ctx)


@auth_required
async def cmd_usage(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("⏳ Calcul en cours…")
    from app.usage_stats import get_usage_stats, format_usage_message
    stats = await asyncio.get_event_loop().run_in_executor(None, get_usage_stats)
    msg = format_usage_message(stats)
    await update.message.reply_text(_truncate(msg), parse_mode=ParseMode.MARKDOWN)


# ──────────────────────────────────────────────── /posts shortcut

@auth_required
async def cmd_posts(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("⏳ Récupération des posts…")
    posts = await _call_mcp_tool("linkedin-scraper", "get_interesting_posts", {})
    if isinstance(posts, str):
        await update.message.reply_text(f"❌ {posts}")
        return
    ctx.user_data["posts_cache"] = posts
    text, keyboard = _format_posts(posts, page=0)
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard, disable_web_page_preview=True)


@auth_required_query
async def cb_posts_page(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    page = int(query.data.split(":")[1])
    posts = ctx.user_data.get("posts_cache", [])
    text, keyboard = _format_posts(posts, page=page)
    await query.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard, disable_web_page_preview=True)


# ──────────────────────────────────────────────── /scrape shortcut

@auth_required
async def cmd_scrape(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Confirmer", callback_data="scrape_confirm"),
        InlineKeyboardButton("❌ Annuler", callback_data="scrape_cancel"),
    ]])
    await update.message.reply_text(
        "Lancer un scrape LinkedIn ? (30–90 secondes)",
        reply_markup=keyboard,
    )


@auth_required_query
async def cb_scrape_confirm(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("⏳ Scrape en cours… (peut prendre jusqu'à 90s)")

    result = await asyncio.get_event_loop().run_in_executor(
        None, _sync_call_mcp_tool, "linkedin-scraper", "scrape_feed", {}
    )

    if isinstance(result, str):
        await query.edit_message_text(f"❌ Erreur : {result}")
        return

    # result is list[dict]; first entry is summary if present
    summary = {}
    posts = result
    if result and "summary" in result[0]:
        summary = result[0]["summary"]
        posts = result[1:]

    lines = ["✅ *Scrape terminé*\n"]
    if summary:
        lines.append(f"Posts trouvés : {summary.get('posts_found', '?')}")
        lines.append(f"Durée : {summary.get('duration_seconds', '?')}s")
    else:
        lines.append(f"Posts : {len(posts)}")

    await query.edit_message_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


@auth_required_query
async def cb_scrape_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("Scrape annulé.")


# ──────────────────────────────────────────────── MCP flow

@auth_required
async def cmd_mcp(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    from app.mcp_client import load_mcp_servers
    servers = load_mcp_servers(PROJECT_DIR)
    if not servers:
        await update.message.reply_text("Aucun serveur MCP enregistré dans .mcp.json.")
        return ConversationHandler.END

    ctx.user_data["mcp_servers"] = servers
    buttons = [[InlineKeyboardButton(name, callback_data=f"mcp_server:{name}")] for name in servers]
    buttons.append([InlineKeyboardButton("❌ Annuler", callback_data="mcp_cancel")])
    await update.message.reply_text(
        "🔌 *Serveurs MCP disponibles* — choisis un serveur :",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return MCP_CHOOSE_SERVER


@auth_required_query
async def cb_mcp_choose_server(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    server_name = query.data.split(":", 1)[1]
    ctx.user_data["mcp_active_server"] = server_name

    await query.edit_message_text(f"⏳ Connexion à *{server_name}*…", parse_mode=ParseMode.MARKDOWN)

    servers = ctx.user_data.get("mcp_servers", {})
    cfg = servers.get(server_name)
    if not cfg:
        await query.edit_message_text("❌ Serveur introuvable.")
        return ConversationHandler.END

    tools = await asyncio.get_event_loop().run_in_executor(
        None, _sync_list_tools, cfg
    )
    if isinstance(tools, str):
        await query.edit_message_text(f"❌ Erreur : {tools}")
        return ConversationHandler.END

    ctx.user_data["mcp_tools"] = {t["name"]: t for t in tools}

    buttons = [
        [InlineKeyboardButton(f"🔧 {t['name']}", callback_data=f"mcp_tool:{t['name']}")]
        for t in tools
    ]
    buttons.append([InlineKeyboardButton("⬅️ Retour", callback_data="mcp_back"), InlineKeyboardButton("❌ Annuler", callback_data="mcp_cancel")])

    await query.edit_message_text(
        f"*{server_name}* — choisis un outil :",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return MCP_CHOOSE_TOOL


@auth_required_query
async def cb_mcp_choose_tool(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    tool_name = query.data.split(":", 1)[1]
    ctx.user_data["mcp_active_tool"] = tool_name
    ctx.user_data["mcp_collected_args"] = {}
    ctx.user_data["mcp_pending_params"] = []

    tools = ctx.user_data.get("mcp_tools", {})
    tool = tools.get(tool_name, {})
    schema = tool.get("inputSchema", {})
    required = schema.get("required", [])
    properties = schema.get("properties", {})

    # Build list of required params not having defaults
    pending = [p for p in required if p in properties]
    ctx.user_data["mcp_pending_params"] = pending
    ctx.user_data["mcp_schema_props"] = properties

    if not pending:
        # No args needed — execute immediately
        await query.edit_message_text(f"⏳ Exécution de *{tool_name}*…", parse_mode=ParseMode.MARKDOWN)
        return await _execute_mcp_tool(query, ctx)

    # Ask for first arg
    first = pending[0]
    prop_info = properties.get(first, {})
    desc = prop_info.get("description", "")
    type_hint = prop_info.get("type", "")
    prompt = f"🔧 *{tool_name}*\n\nArgument `{first}`"
    if type_hint:
        prompt += f" ({type_hint})"
    if desc:
        prompt += f"\n_{desc}_"
    prompt += "\n\nEnvoie la valeur :"

    await query.edit_message_text(prompt, parse_mode=ParseMode.MARKDOWN)
    return MCP_COLLECT_ARGS


@auth_required
async def mcp_collect_arg(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    pending = ctx.user_data.get("mcp_pending_params", [])
    if not pending:
        return ConversationHandler.END

    current_param = pending[0]
    raw_value = update.message.text.strip()
    properties = ctx.user_data.get("mcp_schema_props", {})
    prop_info = properties.get(current_param, {})
    param_type = prop_info.get("type", "string")

    # Coerce type
    value: Any = raw_value
    try:
        if param_type == "integer":
            value = int(raw_value)
        elif param_type == "number":
            value = float(raw_value)
        elif param_type == "boolean":
            value = raw_value.lower() in ("true", "1", "oui", "yes")
        elif param_type == "array":
            # Accept comma-separated or JSON array
            if raw_value.startswith("["):
                value = json.loads(raw_value)
            else:
                value = [v.strip() for v in raw_value.split(",") if v.strip()]
    except (ValueError, json.JSONDecodeError):
        await update.message.reply_text(
            f"❌ Valeur invalide pour `{current_param}` (type attendu : {param_type}). Réessaie :",
            parse_mode=ParseMode.MARKDOWN,
        )
        return MCP_COLLECT_ARGS

    ctx.user_data["mcp_collected_args"][current_param] = value
    remaining = pending[1:]
    ctx.user_data["mcp_pending_params"] = remaining

    if remaining:
        next_param = remaining[0]
        prop_info = properties.get(next_param, {})
        desc = prop_info.get("description", "")
        type_hint = prop_info.get("type", "")
        tool_name = ctx.user_data.get("mcp_active_tool", "?")
        prompt = f"🔧 *{tool_name}*\n\nArgument `{next_param}`"
        if type_hint:
            prompt += f" ({type_hint})"
        if desc:
            prompt += f"\n_{desc}_"
        prompt += "\n\nEnvoie la valeur :"
        await update.message.reply_text(prompt, parse_mode=ParseMode.MARKDOWN)
        return MCP_COLLECT_ARGS

    # All args collected — execute
    msg = await update.message.reply_text(
        f"⏳ Exécution de *{ctx.user_data['mcp_active_tool']}*…",
        parse_mode=ParseMode.MARKDOWN,
    )
    return await _execute_mcp_tool(msg, ctx, is_message=True)


async def _execute_mcp_tool(target, ctx: ContextTypes.DEFAULT_TYPE, is_message: bool = False) -> int:
    server_name = ctx.user_data.get("mcp_active_server")
    tool_name = ctx.user_data.get("mcp_active_tool")
    args = ctx.user_data.get("mcp_collected_args", {})
    servers = ctx.user_data.get("mcp_servers", {})
    cfg = servers.get(server_name, {})

    result = await asyncio.get_event_loop().run_in_executor(
        None, _sync_call_mcp_tool_cfg, cfg, tool_name, args
    )

    if isinstance(result, str):
        text = f"❌ Erreur : {result}"
    else:
        text = _format_tool_result(tool_name, result)

    text = _truncate(text)
    if is_message:
        await target.edit_text(text, parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True)
    else:
        await target.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True)
    return ConversationHandler.END


def _format_tool_result(tool_name: str, data: Any) -> str:
    """Turn tool output into a readable Telegram message."""
    if tool_name == "get_interesting_posts" or tool_name == "get_posts":
        if not isinstance(data, list) or not data:
            return "Aucun post."
        lines = [f"📋 *{len(data)} posts*\n"]
        for i, p in enumerate(data[:10], 1):
            author = p.get("author", "?")
            text = p.get("text", "")[:150].replace("\n", " ")
            score = p.get("score", 0)
            url = p.get("url", "")
            url_part = f" [↗]({url})" if url else ""
            lines.append(f"*{i}. {author}* (score: {score:.1f}){url_part}")
            lines.append(f"_{text}_\n")
        if len(data) > 10:
            lines.append(f"_…et {len(data) - 10} autres. Utilise /posts pour paginer._")
        return "\n".join(lines)

    if tool_name == "scrape_feed":
        if not isinstance(data, list):
            return str(data)
        summary = {}
        posts = data
        if data and "summary" in data[0]:
            summary = data[0]["summary"]
            posts = data[1:]
        lines = ["✅ *Scrape terminé*\n"]
        if summary:
            lines.append(f"Posts trouvés : {summary.get('posts_found', '?')}")
            lines.append(f"Durée : {summary.get('duration_seconds', '?')}s")
        else:
            lines.append(f"Posts : {len(posts)}")
        return "\n".join(lines)

    if tool_name == "get_config":
        if isinstance(data, dict):
            lines = ["⚙️ *Configuration active*\n"]
            for k, v in data.items():
                lines.append(f"`{k}`: `{json.dumps(v, ensure_ascii=False)}`")
            return "\n".join(lines)

    if tool_name == "update_interests":
        if isinstance(data, dict):
            keywords = data.get("interest_keywords", [])
            threshold = data.get("relevance_threshold", "?")
            rescored = data.get("rescored_posts", "?")
            return (
                f"✅ *Intérêts mis à jour*\n\n"
                f"Keywords : `{', '.join(keywords)}`\n"
                f"Seuil : `{threshold}`\n"
                f"Posts re-scorés : {rescored}"
            )

    # Generic fallback
    text = json.dumps(data, indent=2, ensure_ascii=False)
    return f"```\n{text}\n```"


@auth_required_query
async def cb_mcp_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("Annulé.")
    return ConversationHandler.END


@auth_required_query
async def cb_mcp_back(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    """Go back to server selection."""
    query = update.callback_query
    await query.answer()
    servers = ctx.user_data.get("mcp_servers", {})
    buttons = [[InlineKeyboardButton(name, callback_data=f"mcp_server:{name}")] for name in servers]
    buttons.append([InlineKeyboardButton("❌ Annuler", callback_data="mcp_cancel")])
    await query.edit_message_text(
        "🔌 *Serveurs MCP disponibles* — choisis un serveur :",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return MCP_CHOOSE_SERVER


# ──────────────────────────────────────────────────────────────────────── sync MCP helpers
# These run in a thread executor so they can block freely.

def _sync_list_tools(cfg: dict) -> list[dict] | str:
    from app.mcp_client import MCPClient, MCPError
    try:
        with MCPClient(cfg["command"], cfg.get("args", []), cfg.get("cwd")) as client:
            return client.list_tools()
    except MCPError as e:
        return str(e)
    except Exception as e:
        return f"Erreur inattendue : {e}"


def _sync_call_mcp_tool(server_name: str, tool_name: str, arguments: dict) -> Any:
    from app.mcp_client import load_mcp_servers, MCPClient, MCPError
    servers = load_mcp_servers(PROJECT_DIR)
    cfg = servers.get(server_name)
    if not cfg:
        return f"Serveur '{server_name}' introuvable dans .mcp.json"
    return _sync_call_mcp_tool_cfg(cfg, tool_name, arguments)


def _sync_call_mcp_tool_cfg(cfg: dict, tool_name: str, arguments: dict) -> Any:
    from app.mcp_client import MCPClient, MCPError
    try:
        with MCPClient(cfg["command"], cfg.get("args", []), cfg.get("cwd")) as client:
            content = client.call_tool(tool_name, arguments)
            # MCP content is list of {type, text} blocks — extract text
            parts = []
            for block in content:
                if block.get("type") == "text":
                    try:
                        parts.append(json.loads(block["text"]))
                    except (json.JSONDecodeError, KeyError):
                        parts.append(block.get("text", ""))
            if len(parts) == 1:
                return parts[0]
            return parts if parts else content
    except MCPError as e:
        return str(e)
    except Exception as e:
        return f"Erreur inattendue : {e}"


async def _call_mcp_tool(server_name: str, tool_name: str, arguments: dict) -> Any:
    return await asyncio.get_event_loop().run_in_executor(
        None, _sync_call_mcp_tool, server_name, tool_name, arguments
    )


# ──────────────────────────────────────────────────────────────────────── main

def main():
    app = Application.builder().token(BOT_TOKEN).build()

    # /usage and /posts — simple commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("usage", cmd_usage))
    app.add_handler(CommandHandler("posts", cmd_posts))
    app.add_handler(CommandHandler("scrape", cmd_scrape))

    # Posts pagination callback
    app.add_handler(CallbackQueryHandler(cb_posts_page, pattern=r"^posts_page:"))

    # Scrape confirmation callbacks
    app.add_handler(CallbackQueryHandler(cb_scrape_confirm, pattern=r"^scrape_confirm$"))
    app.add_handler(CallbackQueryHandler(cb_scrape_cancel, pattern=r"^scrape_cancel$"))

    # MCP conversation flow
    mcp_conv = ConversationHandler(
        entry_points=[CommandHandler("mcp", cmd_mcp)],
        states={
            MCP_CHOOSE_SERVER: [
                CallbackQueryHandler(cb_mcp_choose_server, pattern=r"^mcp_server:"),
                CallbackQueryHandler(cb_mcp_cancel, pattern=r"^mcp_cancel$"),
            ],
            MCP_CHOOSE_TOOL: [
                CallbackQueryHandler(cb_mcp_choose_tool, pattern=r"^mcp_tool:"),
                CallbackQueryHandler(cb_mcp_back, pattern=r"^mcp_back$"),
                CallbackQueryHandler(cb_mcp_cancel, pattern=r"^mcp_cancel$"),
            ],
            MCP_COLLECT_ARGS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, mcp_collect_arg),
                CallbackQueryHandler(cb_mcp_cancel, pattern=r"^mcp_cancel$"),
            ],
        },
        fallbacks=[CallbackQueryHandler(cb_mcp_cancel, pattern=r"^mcp_cancel$")],
        per_user=True,
        per_chat=True,
    )
    app.add_handler(mcp_conv)

    logger.info("Bot démarré — long-polling actif")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
