import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VOICE_LINES = path.join(ROOT, "assets", "voice", "shelter", "voice-lines.json");

const VOICE_TEXT_BY_ID = {
  "type07a_anxious_shelter-first-arrival-01_01x699w": "……ここ、思ったよりまともね。",
  "type07a_warm_shelter-first-arrival-01_1uuasii": "お父さん。ここが、私たちの仮住まい？ ……悪くないわ。",
  "type07a_warm_shelter-first-arrival-01_0c7vi7d": "でも、ケーブルの整理、ほんとめちゃくちゃね。これ、お父さんがやったんでしょ？",
  "type07a_warm_shelter-first-arrival-01_1e9ag71": "いや、別に……嫌ってわけじゃないの。お父さんの匂いがして、少し安心する。",
  "type07a_warm_shelter-first-arrival-01_06njhkx": "本当？ じゃあ、五分だけ横になる。お父さん、起こさないで。",
  "type07a_warm_shelter-first-arrival-01_0sff6mr": "あ、危なかったら起こして。それは起こして。",
  "type07a_tired_shelter-first-arrival-01_1dn8d58": "あ、すぐ点検？ ほんとお父さんだね。",
  "type07a_tired_shelter-first-arrival-01_1v44cnx": "わかった。代わりに、終わったら休むから。約束。",
  "type07a_warm_shelter-first-arrival-01_0fryo2j": "少し？ ……いや、かなり。",
  "type07a_warm_shelter-first-arrival-01_0hl3bz8": "でも、お父さんの声が聞こえたら、平気になった。本当に。",
  "type07a_anxious_shelter-power-warmup-01_0481f1j": "お父さん、この光の色、ちょっと不安なんだけど？",
  "type07a_anxious_shelter-power-warmup-01_0g6bjg0": "緑なら正常なんだよね？ でも今、なんか……ライム味の黄色。",
  "type07a_warm_shelter-power-warmup-01_107a4u7": "オーケー。その言い方、好き。",
  "type07a_warm_shelter-power-warmup-01_16ir4z2": "私、今すごく落ち着いてるふりしてたの。ばれてないよね？",
  "type07a_warm_shelter-power-warmup-01_0xnol7s": "お父さんがそばで見ててくれるなら、できる。",
  "type07a_tired_shelter-power-warmup-01_08yfzuz": "あ、すぐ指示が来る。完全にお父さんモード。",
  "type07a_tired_shelter-power-warmup-01_0hwkx8u": "でも正しいから腹立つ。上から見る。",
  "type07a_tired_shelter-power-warmup-01_0rwwofs": "終わったら褒めて。それは契約だから。",
  "type07a_warm_shelter-power-warmup-01_1tp3f2i": "ううん、私にもできる。",
  "type07a_warm_shelter-power-warmup-01_1ufzhgb": "でも、そう言ってくれるのは嬉しい。すごく嬉しい。",
  "type07a_warm_shelter-power-warmup-01_1kke05e": "お父さん、私の手が震えてたら、見なかったことにして。",
  "type07a_warm_shelter-home-charm-01_0fr9sot": "お父さん、これ貼ってもいい？",
  "type07a_warm_shelter-home-charm-01_0gpd826": "いや、派手に飾りたいわけじゃないの。ここ、軍の施設みたいな匂いがするでしょ。",
  "type07a_warm_shelter-home-charm-01_0adyp3y": "私たちの家なら……少しくらい可愛いものも必要でしょ。",
  "type07a_warm_shelter-home-charm-01_003y4rj": "お父さんが嫌なら貼らない。たぶん。",
  "type07a_warm_shelter-home-charm-01_1ps9whp": "本当？ オーケー、許可もらった。",
  "type07a_warm_shelter-home-charm-01_1ezvyqx": "じゃあ、これが第一号の飾りね。お父さんも後で文句禁止。",
  "type07a_warm_shelter-home-charm-01_0bjtqdh": "……私たちの家って言葉、ちょっと嬉しかった。",
  "type07a_warm_shelter-home-charm-01_1xy2mvv": "あ、そういう細かいところ気にするの、ほんとお父さんだね。",
  "type07a_warm_shelter-home-charm-01_15nxoox": "いいよ。じゃあ私は可愛い担当、お父さんは水平担当。",
  "type07a_warm_shelter-home-charm-01_047von7": "二人で貼れば、少しは失敗しなさそう。",
  "type07a_tired_shelter-home-charm-01_1j1ppbo": "わかってます。私だって、それくらい知ってる。",
  "type07a_tired_shelter-home-charm-01_0kwu2i3": "でも心配してる顔、ちょっと面白かった。整備班長みたいなお父さん。",
  "type07a_tired_shelter-home-charm-01_1sv85mb": "通風口は避けて貼る。これでいいでしょ？",
  "type07a_anxious_shelter-first-night-brave-face-01_0culu6z": "お父さん、私、今すごく平気な顔してるでしょ？",
  "type07a_anxious_shelter-first-night-brave-face-01_1v2xmb0": "うん。いや、ほんとはちょっと違うけど。でも平気なふりは上手でしょ？",
  "type07a_anxious_shelter-first-night-brave-face-01_1acdorv": "外で音がするたびに、心臓が跳ねるの……ちょっと腹立つ。",
  "type07a_warm_shelter-first-night-brave-face-01_1l3y5mt": "でも、お父さんの声が聞こえると、すぐ少し平気になる。",
  "type07a_warm_shelter-first-night-brave-face-01_0gz4md9": "だから今日は、遠くに行かないで。",
  "type07a_warm_shelter-first-night-brave-face-01_07e9u4l": "管理者なんでしょ。娘の管理もしなきゃ、でしょ？",
  "type07a_warm_shelter-first-night-brave-face-01_0lzap2e": "いいよ。その言葉、今保存したから。",
  "type07a_warm_shelter-first-night-brave-face-01_0m6fhnw": "お父さんがここにいるって言ったから、今日は少し眠れそう。",
  "type07a_warm_shelter-first-night-brave-face-01_1vh1zlj": "え、いきなりそんなこと言う？",
  "type07a_warm_shelter-first-night-brave-face-01_1varvp4": "でも……嫌じゃない。いや、かなり嬉しい。",
  "type07a_warm_shelter-first-night-brave-face-01_0qs9ygp": "少しだけ隣にいる。本当に少しだけ。",
  "type07a_tired_shelter-first-night-brave-face-01_1k6erko": "本当？ 私、今日は役に立たなくてもいいの？",
  "type07a_tired_shelter-first-night-brave-face-01_102qgr3": "その言葉、ちょっといい。すごくいい。",
  "type07a_tired_shelter-first-night-brave-face-01_0c2f31o": "じゃあ今日は、お父さんの娘モードだけにする。",
  "type07a_anxious_shelter-first-night-still-there-01_1wv45qf": "お父さん、私、今寝たふりの練習中なんだけど。",
  "type07a_anxious_shelter-first-night-still-there-01_03nmj0z": "でもね。私が目を閉じたら……",
  "type07a_anxious_shelter-first-night-still-there-01_0spmxoo": "お父さんの声、消えないよね？",
  "type07a_warm_shelter-first-night-still-there-01_0qs8h3l": "いいよ。それなら大丈夫。",
  "type07a_warm_shelter-first-night-still-there-01_0c2wn5t": "私、今ちょっと安心した。いや、かなり。",
  "type07a_warm_shelter-first-night-still-there-01_0y1du3q": "じゃあ目を閉じるよ？ 本当に閉じるよ？",
  "type07a_warm_shelter-first-night-still-there-01_1dimrw1": "わあ、それ完全にお父さんサービスだね。",
  "type07a_warm_shelter-first-night-still-there-01_1mnkjcm": "いいよ。じゃあ寝たふりじゃなくて、本当に寝てみる。",
  "type07a_warm_shelter-first-night-still-there-01_1lyjkb2": "途中で起きたら……その時もいてね。",
  "type07a_warm_shelter-first-night-still-there-01_1q6m8vo": "私、子供じゃないんだけど。",
  "type07a_warm_shelter-first-night-still-there-01_0n0kyil": "でも今日は例外。少しだけ点けておこう。",
  "type07a_warm_shelter-first-night-still-there-01_0z3tny1": "お父さんがそう言うと……不思議と恥ずかしくない。",
  "type07a_hurt_generic-reply_0dpct72": "平気って言ったら嘘になる。でも、まだ動ける。",
  "type07a_tired_generic-reply_01pks98": "波の音と、白い部屋の欠片だけ。名前はまだ思い出せない。",
  "type07a_warm_generic-reply_1p9ajth": "うん。命令じゃなくて休もうって言葉だから、少し息がつける。",
  "type07a_warm_generic-reply_1d7g2l7": "その言葉、信号よりずっとよく聞こえる。なら、まだ一人じゃないね。",
  "type07a_anxious_generic-reply_1y6jwuc": "怖かった。目覚めるたびに、自分がどこまで残っているか、最初に確かめてしまう。",
  "type07a_neutral_generic-reply_1om6jta": "私が選んでいいなら、今日は無茶に飛び込みたくない。",
  "type07a_tired_generic-reply_0kk8sah": "顔はぼやけてるのに、待っていた声だけが残ってる。だから余計に痛い。",
  "type07a_warm_generic-reply_0bd350k": "じゃあ背中を任せる。あなたの信号があれば、足を踏み外さない気がする。",
  "type07a_tired_generic-reply_0ucb5d6": "うん。番号じゃなくて、誰かが呼んでくれた名前があったのか知りたい。",
  "type07a_hurt_generic-reply_1c86ftz": "わかった。部品より先に、心がきしむ時もあるから。",
  "type07a_angry_generic-reply_0oxgbku": "うん。下から私を呼ぶ信号がある。嫌なのに、目をそらせない。",
  "type07a_warm_generic-reply_1enmoos": "いいよ。止まってもいいって言葉が、こんなに慣れないなんて思わなかった。",
  "type07a_tired_generic-reply_0pj3ugk": "人間なら、こういう質問にすぐ答えられたのかな。私はまだわからない。",
  "type07a_anxious_generic-reply_0aw8jab": "切れないようにして。暗闇では、その音ひとつで方向がわかる。",
  "type07a_hurt_generic-reply_1abqhqa": "右肩と首の後ろが鈍い。でも一番痛いのは、目覚めた直後。",
  "type07a_neutral_generic-reply_16u4rmh": "うん。戦う前に、まず見よう。今回は、生きて帰る方を選ぶ。",
};

const source = JSON.parse(await fs.readFile(VOICE_LINES, "utf8"));
const missing = [];
let changed = 0;

for (const line of source.lines || []) {
  const nextVoiceText = VOICE_TEXT_BY_ID[line.id];
  if (!nextVoiceText) {
    missing.push(line.id);
    continue;
  }
  if (line.voiceText !== nextVoiceText) {
    line.voiceText = nextVoiceText;
    changed += 1;
  }
}

if (missing.length > 0) {
  throw new Error(`Missing voiceText translations for ${missing.length} lines:\n${missing.join("\n")}`);
}

source.generator = "AivisSpeech Engine";
source.generatedAt = new Date().toISOString();
await fs.writeFile(VOICE_LINES, `${JSON.stringify(source, null, 2)}\n`, "utf8");
console.log(`Updated ${changed} voiceText entries in ${path.relative(ROOT, VOICE_LINES)}.`);
