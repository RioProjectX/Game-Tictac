const Telegraf = require("telegraf");
const config = require("./config");
const CustomMap = require("./custom_map");
const crypto = require("crypto");

const bot = new Telegraf.Telegraf(config.token);
const ticks = new CustomMap();
const tombols = new CustomMap();

bot.launch({
    allowedUpdates: false
}).then(() => {
    bot.telegram.getMe().then(x => {
        console.log("Logged", "in", x.username);
    });
});

function inGame(chatId, userId) {
    const json = ticks.toJSON();
    if (!json.find(ch => ch.name == chatId)) ticks.set(chatId, {});
    const cht = ticks.toJSON().find(ch => ch.name == chatId).value;
    if (!cht[userId]) {
        const users = Object.values(cht);
        const userInGame = users.find(u => u.lawan == userId);
        if (userInGame) return true;
        return false;
    } else {
        return true;
    }
}

function findMessageID(mId) {
    const json = ticks.toArray();
    for (let index = 0; index < json.length; index++) {
        const chat = json[index];
        const users = Object.values(chat);
        const m = users.find(ch => ch.message_id == mId);
        return m;
    }

    return undefined;
}

function chunknize(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

async function findWinner(gameId) {
    const json = tombols.get(gameId);
    if (!json) return false;

    const whoIsIt = (t) => {
        if (t.toLowerCase() == "o") return "fighter";
        else if (t.toLowerCase() == "x") return "owner";
        else return "unknown";
    };

    if (json[0].text == json[1].text && json[0].text == json[2].text) {
        return whoIsIt(json[0].text);
    } else if (json[3].text == json[4].text && json[3].text == json[5].text) {
        return whoIsIt(json[3].text);
    } else if (json[6].text == json[7].text && json[6].text == json[8].text) {
        return whoIsIt(json[6].text);
    } else if (json[0].text == json[4].text && json[0].text == json[8].text) {
        return whoIsIt(json[8].text);
    } else if (json[1].text == json[4].text && json[1].text == json[7].text) {
        return whoIsIt(json[7].text);
    } else if (json[2].text == json[5].text && json[2].text == json[8].text) {
        return whoIsIt(json[2].text);
    } else if (json[2].text == json[4].text && json[2].text == json[6].text) {
        return whoIsIt(json[6].text);
    } else if (json[0].text == json[3].text && json[0].text == json[6].text) {
        return whoIsIt(json[6].text);
    }

    return "unknown";
}

bot.command(["cancel", "destroy"], async (ctx) => {
    const game = inGame(ctx.chat.id,ctx.from.id);
    if (!game) return await ctx.reply("You don't have tictactoe game here!");
    else {
        const chat = ticks.toJSON().find(c => c.name == ctx.chat.id);
        delete chat[ctx.from.id];
        if (game.game_id in tombols) tombols.delete(game.game_id);
        ticks.set(ctx.chat.id, chat);
        await ctx.reply("Game canceled!");
    }
});

bot.command("tictactoe", async (ctx) => {
    if (ctx.chat.type == "private" || ctx.chat.type == "channel") return;
    const playerInGame = inGame(ctx.chat.id,ctx.from.id);
    if (playerInGame) return await ctx.replyWithMarkdown(`You already in game!\nSee: https://t.me/${ctx.chat.username ? ctx.chat.username : ctx.chat.id}/${playerInGame.message_id}`);

    const gameId = crypto.randomUUID().split("-")[0];
    const keyboards = [
        [
            {
                text: "⁣",
                callback_data: "⁣1"
            }, {
                text: "⁣",
                callback_data: "2⁣"
            }, {
                text: "⁣",
                callback_data: "⁣3"
            }
        ],[
            {
                text: "⁣",
                callback_data: "⁣4"
            }, {
                text: "⁣",
                callback_data: "⁣5"
            }, {
                text: "⁣",
                callback_data: "⁣6"
            }
        ],[
            {
                text: "⁣",
                callback_data: "⁣7"
            }, {
                text: "⁣",
                callback_data: "⁣8"
            }, {
                text: "⁣",
                callback_data: "⁣9"
            }
        ],
    ];
    const m = await ctx.replyWithMarkdown(`Tictactoe Game\n\nOwner: ${ctx.from.first_name}\nGame ID: ${gameId}`, {
        reply_markup: {
            inline_keyboard: [[{ text: "Join", callback_data: "join-" + gameId}], ...keyboards]
        }
    });

    
    ticks.set(ctx.chat.id, {
        [ctx.from.id]: {
            lawan: undefined,
            game_id: gameId,
            player: undefined,
            message_id: m.message_id,
            _owner: ctx.from.id
        }
    });
});

bot.on("callback_query", async (ctx) => {
    if (!ctx.update.callback_query.message) return;
    const me = await bot.telegram.getMe();
    if (ctx.update.callback_query.message.from.id != me.id) return;
    const messid = ctx.update.callback_query.message.message_id;
    const mtick = findMessageID(messid);
    if (!mtick) return await ctx.deleteMessage(messid);
    const data = ctx.update.callback_query.data;

    if (data.startsWith("join-")) {
        const chat = ticks.toJSON().find(c => c.name == ctx.chat.id).value;
        if (ctx.update.callback_query.from.id == mtick._owner) return await ctx.answerCbQuery("You are the game creator, you can't join to your game.");
        else if (mtick.lawan) return await ctx.answerCbQuery("This game is already have fighter");
        chat[mtick._owner].lawan = ctx.update.callback_query.from.id;
        chat[mtick._owner].player = mtick._owner;

        await ctx.answerCbQuery("Ah joined, please wait for owner click the button below");
        ticks.set(ctx.update.callback_query.message.chat.id, chat);
        const keyboards = ctx.update.callback_query.message.reply_markup.inline_keyboard.filter(x => x.length == 3);
        const tombolees = [];
        keyboards.forEach(keyboard => {
            keyboard.forEach(keyb => {
                tombolees.push(keyb);
            });
        });
        tombols.set(mtick.game_id, tombolees);
        await ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, "", `${ctx.update.callback_query.message.text}\nFighter: ${ctx.update.callback_query.from.first_name}\n\n\`X\` for owner and \`O\` for fighter.`, {
           parse_mode: "Markdown",
           reply_markup: {
                inline_keyboard: keyboards
           }
        });
    } else {
        if (!mtick.lawan) return await ctx.answerCbQuery("This game cannot started without fighter!");
        else if (mtick.lawan != ctx.update.callback_query.from.id && mtick._owner != ctx.update.callback_query.from.id) return await ctx.answerCbQuery("You aren't in game");
        const chat = ticks.toJSON().find(c => c.name == ctx.chat.id).value;
        const game = chat[mtick._owner];
        if (game.player != ctx.update.callback_query.from.id) return await ctx.answerCbQuery("Please wait for another player choose.");
        const tombolss = tombols.get(game.game_id);
        if (!tombolss.filter(t => t.text != "X" || t.text != "O").length) {
            tombols.delete(game.game_id);
            delete chat[mtick._owner];
            ticks.set(ctx.update.callback_query.message.chat.id, chat);
            await ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, "", `${ctx.update.callback_query.message.text}\nDraw!`, {
                parse_mode: "Markdown"
            });
            return;
        }
        const tombol = tombolss.find(t => t.callback_data == data).text;
        if (tombol == "X") return await ctx.answerCbQuery("This column has answered by owner");
        else if (tombol == "O") return await ctx.answerCbQuery("This column has answered by fighter");
        tombolss.find(t => t.callback_data == data).text = game.player == game._owner ? "X" : "O";
        game.player = game.player == game._owner ? game.lawan : game._owner;
        tombols.set(game.game_id, tombolss);
        await ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, "", ctx.update.callback_query.message.text, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: chunknize(tombolss, 3)
            }
        });

        const winner = await findWinner(game.game_id);
        if (winner != "unknown") {
            let winnerID = undefined;
            if (winner == "owner") winnerID = game._owner;
            else if (winner == "fighter") winnerID = game.lawan;
            tombols.delete(game.game_id);
            delete chat[mtick._owner];
            ticks.set(ctx.update.callback_query.message.chat.id, chat);
            await ctx.telegram.editMessageText(ctx.update.callback_query.message.chat.id, ctx.update.callback_query.message.message_id, "", `${ctx.update.callback_query.message.text}\nThis [person](tg://user?id=${winnerID}) won!`, {
                parse_mode: "Markdown"
            });
            return;
        }
    }
});
