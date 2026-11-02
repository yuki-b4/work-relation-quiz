// 自動生成。直接編集しない。
// 生成元：セミナーLP文面.md（文面と開催情報の正）と app/assets/seminar/{slug}/ の画像
// 再生成：cd app && npm run content
// /seminar/{slug} の中身（アプリ化要件定義.md F4-5「セミナーの告知ページ」）
import img_sem_1010_hero from '../../assets/seminar/sem-1010/hero.jpg';
import img_sem_1010_og from '../../assets/seminar/sem-1010/og.png';
import img_sem_1010_speaker from '../../assets/seminar/sem-1010/speaker.jpg';
import img_sem_1020_hero from '../../assets/seminar/sem-1020/hero.jpg';
import img_sem_1020_og from '../../assets/seminar/sem-1020/og.png';
import img_sem_1020_speaker from '../../assets/seminar/sem-1020/speaker.jpg';
import img_sem_1026_hero from '../../assets/seminar/sem-1026/hero.jpg';
import img_sem_1026_og from '../../assets/seminar/sem-1026/og.png';
import img_sem_1026_speaker from '../../assets/seminar/sem-1026/speaker.jpg';
import img_sem_1111_speaker from '../../assets/seminar/sem-1111/speaker.jpg';

export type SeminarImage = {
  data: ArrayBuffer;
  mime: 'image/png' | 'image/jpeg';
  /** URL に付ける拡張子。jpeg も jpg に揃える。 */
  ext: 'png' | 'jpg';
  width: number;
  height: number;
  /** 中身から作った短い印。URL の ?v= に付けて、差し替えたときに古いキャッシュを使わせない。 */
  version: string;
};

/** eyebrow は見出しの上に小さく出す英字（無ければ空文字）。fill はスマホで本文を幅いっぱいまで詰めて折り返す節。 */
export type SeminarSection =
  | { kind: 'text'; heading: string; eyebrow: string; fill: boolean; html: string }
  | { kind: 'speaker'; heading: string; eyebrow: string; fill: boolean; html: string }
  | { kind: 'overview'; heading: string; eyebrow: string; fill: boolean }
  | { kind: 'faq'; heading: string; eyebrow: string; fill: boolean; items: { q: string; html: string; text: string }[] };

export type Seminar = {
  slug: string;
  title: string;
  description: string;
  /** ファーストビューに手書き風の書体で出す一文。1要素が1行。 */
  catchLines: string[];
  /** 見出し。要素の切れ目で改行する（狭い画面でも）。 */
  /** 見出しの上に小さく添える短い名乗り（例：診断セミナー）。h1 の一部として読み上げる。空なら出さない。 */
  kicker: string;
  headlineLines: string[];
  subLines: string[];
  /** 開催日（YYYY-MM-DD）と時刻（HH:MM）。いずれも日本時間。 */
  date: string;
  start: string;
  end: string;
  place: string;
  placeNote: string;
  fee: string;
  /** Peatix のイベントページ。空のあいだは申込ボタンを押せない。 */
  ticketUrl: string;
  /** 申込ボタンのすぐ下に添える一文。空なら出さない。 */
  ctaNote: string;
  /** ページの最後、申込ボタンの上に置く一文。「|」の位置で改行する。空なら出さない。 */
  closing: string;
  /** 締めのひと言の下に置く短い文。空なら出さない。 */
  closingNote: string;
  /** 定員の表記（例：10名（先着順））。空なら開催概要に出さない。 */
  capacity: string;
  /** ファーストビューの丸いバッジ（3つまで）。事実だけ。 */
  badges: { label: string; value: string }[];
  speakerName: string;
  speakerRole: string;
  /** 最初の見出しより前の導入。組み立て済みのHTML。 */
  lead: string;
  sections: SeminarSection[];
  images: { hero?: SeminarImage; og?: SeminarImage; speaker?: SeminarImage };
};

/**
 * 素の文字列（見出し・質問・見出しの行・締めの文など）を、文節の切れ目に <wbr> を入れた HTML に引く表。
 * 画面の側は `PHRASES[文字列] ?? esc(文字列)` で使う。title や構造化データには素の文字列を使う。
 */
export const PHRASES: Record<string, string> = {
  "「自分が悪い」": "「自分が<wbr>悪い」",
  "と思ってしまうクセの": "と<wbr>思ってしまう<wbr>クセの",
  "やめ方": "やめ方",
  "性格診断だけでは作れない": "性格診断だけでは<wbr>作れない",
  "自然体でいられる関係": "自然体で<wbr>いられる<wbr>関係",
  "参加は無料です": "参加は<wbr>無料です",
  "辞めるかどうか、まだ決めきれない。人に相談するのは、少し苦手。そんな方こそ、次の職場を探す前に、60分だけ自分の関わり方を見てみませんか。": "辞めるか<wbr>どうか、<wbr>まだ<wbr>決めきれない。<wbr>人に<wbr>相談するのは、<wbr>少し<wbr>苦手。<wbr>そんな<wbr>方こそ、<wbr>次の<wbr>職場を<wbr>探す前に、<wbr>60分だけ<wbr>自分の<wbr>関わり方を<wbr>見てみませんか。",
  "顔出し・発言なしで参加OK": "顔出し・発言なしで<wbr>参加OK",
  "Zoomで開催します。参加用のURLは、お申し込み後にPeatixからお送りします": "Zoomで<wbr>開催します。<wbr>参加用の<wbr>URLは、<wbr>お申し込み後に<wbr>Peatixから<wbr>お送りします",
  "こんなお悩み、ありませんか": "こんな<wbr>お悩み、<wbr>ありませんか",
  "それは、あなたの性格のせいではありません": "それは、<wbr>あなたの<wbr>性格の<wbr>せいではありません",
  "本や性格診断では、足りなかった理由": "本や<wbr>性格診断では、<wbr>足りなかった<wbr>理由",
  "すり減る関係から、抜け出すには": "すり<wbr>減る<wbr>関係から、<wbr>抜け出すには",
  "当日の流れ": "当日の<wbr>流れ",
  "転職を、すすめも止めもしません": "転職を、すすめも<wbr>止めもしません",
  "登壇者": "登壇者",
  "開催概要": "開催概要",
  "よくあるご質問": "よく<wbr>ある<wbr>ご質問",
  "事前に診断を受けておく必要はありますか？": "事前に<wbr>診断を<wbr>受けて<wbr>おく<wbr>必要は<wbr>ありますか？",
  "途中で抜けても大丈夫ですか？": "途中で<wbr>抜けても<wbr>大丈夫ですか？",
  "必要なものはありますか？": "必要な<wbr>ものは<wbr>ありますか？",
  "売り込みはされませんか？": "売り込みは<wbr>されませんか？",
  "職場以外の人間関係の悩みがあっても参加できますか？": "職場以外の<wbr>人間関係の<wbr>悩みが<wbr>あっても<wbr>参加できますか？",
  "転職して人間関係が": "転職して<wbr>人間関係が",
  "うまくいく人が": "うまく<wbr>いく<wbr>人が",
  "やっていること": "やっている<wbr>こと",
  "あなたの周りに": "あなたの<wbr>周りに",
  "良い人が集まる": "良い<wbr>人が<wbr>集まる",
  "関わり方": "関わり方",
  "スキマ時間で": "スキマ時間で",
  "稼ぐ力の": "稼ぐ<wbr>力の",
  "身につけ方": "身に<wbr>つけ方",
  "「時間がない」を、": "「時間が<wbr>ない」を、",
  "言い訳にしない": "言い訳に<wbr>しない",
  "効率的な副業の始め方": "効率的な<wbr>副業の<wbr>始め方",
  "毎日忙しくて、何から始めればいいか分からない。一人だと、つい後回しにしてしまう。そんな方こそ、60分だけ、一緒に手を動かしてみませんか。": "毎日<wbr>忙しくて、<wbr>何から<wbr>始めればいいか<wbr>分からない。<wbr>一人だと、<wbr>つい<wbr>後回しに<wbr>してしまう。<wbr>そんな<wbr>方こそ、<wbr>60分だけ、<wbr>一緒に<wbr>手を<wbr>動かしてみませんか。",
  "多くの人がやろうと思っても自分の名前で稼げない理由": "多くの<wbr>人が<wbr>やろうと<wbr>思っても<wbr>自分の<wbr>名前で<wbr>稼げない<wbr>理由",
  "聞くだけで終わらない、ワークショップ付きの60分": "聞くだけで<wbr>終わらない、<wbr>ワークショップ付きの<wbr>60分",
  "目指すのは、こんな毎日": "目指すのは、<wbr>こんな<wbr>毎日",
  "ご用意いただくもの": "ご用意いただく<wbr>もの",
  "最後まで参加した方へ、豪華プレゼント3点": "最後まで<wbr>参加した<wbr>方へ、<wbr>豪華プレゼント3点",
  "開催条件": "開催条件",
  "キャンセルについて": "キャンセルに<wbr>ついて",
  "何をやるか、まだ決まっていなくても参加できますか？": "何を<wbr>やるか、<wbr>まだ<wbr>決まっていなくても<wbr>参加できますか？",
  "AIを使ったことがなくても大丈夫ですか？": "AIを<wbr>使った<wbr>ことがなくても<wbr>大丈夫ですか？",
  "会社を辞めるつもりはありませんが、参加できますか？": "会社を<wbr>辞める<wbr>つもりは<wbr>ありませんが、<wbr>参加できますか？"
};

export const SEMINARS: Record<string, Seminar> = {
  "sem-1010": {
    "slug": "sem-1010",
    "title": "転職する前に知りたかった。「自分が悪い」と思ってしまうクセのやめ方｜人間関係タイプ診断つきセミナー",
    "description": "転職しても、また同じような人間関係でしんどくなる。そんな方のための、60分の無料オンラインセミナーです。その場でナチュール診断を受け、「自分が悪い」と感じる場面で本当は何が起きているのかを読み解きます。顔出し・発言なしで参加できます。",
    "catchLines": [
      "転職する前に、",
      "知りたかった。"
    ],
    "kicker": "人間関係タイプ診断つきセミナー",
    "headlineLines": [
      "「自分が悪い」",
      "と思ってしまうクセの",
      "やめ方"
    ],
    "subLines": [
      "性格診断だけでは作れない",
      "自然体でいられる関係"
    ],
    "date": "2026-10-10",
    "start": "13:00",
    "end": "14:00",
    "place": "オンライン",
    "placeNote": "Zoomで開催します。参加用のURLは、お申し込み後にPeatixからお送りします",
    "fee": "無料",
    "ticketUrl": "https://peatix.com/event/5200484",
    "ctaNote": "顔出し・発言なしで参加OK",
    "closing": "参加は無料です",
    "closingNote": "辞めるかどうか、まだ決めきれない。人に相談するのは、少し苦手。そんな方こそ、次の職場を探す前に、60分だけ自分の関わり方を見てみませんか。",
    "capacity": "10名（先着順）",
    "badges": [
      {
        "label": "所要時間",
        "value": "60分"
      },
      {
        "label": "参加費",
        "value": "無料"
      },
      {
        "label": "顔出し・発言",
        "value": "なしでOK"
      }
    ],
    "speakerName": "齋藤祐希",
    "speakerRole": "プロコーチ／ナチュール診断 開発者／Mikata 代表",
    "lead": "<p>転職しても<wbr>同じような<wbr>人間関係でしんどくなり、<wbr>その<wbr>たびに<wbr>「自分が<wbr>悪いのかな」と<wbr>考えてしまう。</p><p>その<wbr>原因は<wbr>性格ではなく、<wbr>自分では<wbr>気づきにくい<wbr>関わり方の<wbr>クセに<wbr>あり、<wbr>本や<wbr>性格診断では<wbr>見えてきません。</p><p>その<wbr>場の<wbr>診断で<wbr>自分の<wbr>関わり方の<wbr>クセを<wbr>知り、<wbr>どうすれば<wbr>抜け出せるかまでを<wbr>解説します。</p>",
    "sections": [
      {
        "kind": "text",
        "heading": "こんなお悩み、ありませんか",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>転職しても、<wbr>なぜか<wbr>毎回、<wbr>苦手な<wbr>人が<wbr>いる</li><li>相手は<wbr>平気そうなのに、<wbr>自分だけが<wbr>どっと<wbr>疲れている</li><li>人と<wbr>うまく<wbr>いかないと、<wbr>「自分の<wbr>言い方が<wbr>悪かったのかな」と<wbr>何日も<wbr>引きずる</li><li>好き嫌いは<wbr>はっきり<wbr>あるのに、<wbr>顔には<wbr>出さずに<wbr>合わせている</li><li>本や<wbr>YouTubeで<wbr>調べて、<wbr>頭では<wbr>わかっている。<wbr>でも、<wbr>いざ<wbr>その<wbr>人の<wbr>前だと<wbr>うまく<wbr>できない</li><li>職場の<wbr>人間関係の<wbr>悩みを、<wbr>誰にも<wbr>相談できずに<wbr>いる</li><li>転職サイトを<wbr>開いては、<wbr>閉じている</li></ul>"
      },
      {
        "kind": "text",
        "heading": "それは、あなたの性格のせいではありません",
        "eyebrow": "",
        "fill": false,
        "html": "<p>人間関係が<wbr>うまく<wbr>いくかどうかは、<wbr>性格の<wbr>良し悪しでは<wbr>決まりません。</p><p>こちらの<wbr>気づかいが、<wbr>相手には<wbr>違う形で<wbr>伝わる<wbr>ことがあります。</p><figure class=\"lp-illust\" role=\"img\" aria-label=\"気をつかって黙っていたのに、「何を考えているかわからない人」と思われることもあります。\" data-illust=\"silence\" data-labels=\"気をつかって、／黙っておこう|何を考えているのか、／わからない…\"></figure><p>すれ違いのもとは、<wbr>性格<wbr>その<wbr>ものではなく、<strong><wbr>関わり方の<wbr>クセ</strong>に<wbr>あることが<wbr>よく<wbr>あります。<wbr>だから<wbr>職場を<wbr>変えても、<wbr>同じ<wbr>クセの<wbr>ままで<wbr>いると、<wbr>同じことがくり返されます。</p><p>クセは、<wbr>欠点ではありません。<wbr>自分が<wbr>どんな<wbr>クセで<wbr>人と<wbr>関わっているのかが<wbr>わかれば、<wbr>「自分が<wbr>悪い」の<wbr>ひと言で<wbr>片づけずに<wbr>済みます。</p>"
      },
      {
        "kind": "text",
        "heading": "本や性格診断では、足りなかった理由",
        "eyebrow": "",
        "fill": true,
        "html": "<p><strong>本や<wbr>YouTube</strong>に<wbr>書いてあるのは、<wbr>誰に<wbr>でも<wbr>当ては<wbr>まる<wbr>一般論です。<wbr>あなた<wbr>自身の<wbr>関わり方に<wbr>合わせた<wbr>答えではありません。</p><p><strong><wbr>性格診断</strong>で<wbr>わかるのは、<wbr>あなたが<wbr>どんな<wbr>性格か、<wbr>までです。<wbr>人と<wbr>どう<wbr>関わっているのか、<wbr>どこですれ違いやすいのかまでは、<wbr>教えてくれません。</p><p>そして、<strong><wbr>自分の<wbr>関わり方の<wbr>クセ</strong>は、<wbr>自分ではなかなか<wbr>気づけません。<wbr>知っているだけでは<wbr>変わらないのは、<wbr>この<wbr>ためです。</p>"
      },
      {
        "kind": "text",
        "heading": "すり減る関係から、抜け出すには",
        "eyebrow": "",
        "fill": false,
        "html": "<p>まず、<wbr>自分が<wbr>ふだん<wbr>どんな<wbr>ふうに<wbr>人と<wbr>関わっているのかを<wbr>知る<wbr>ことから<wbr>始めます。</p><p>その<wbr>ために<wbr>使うのが、<wbr>あなたの<wbr>人間関係タイプを<wbr>特定する<strong><wbr>ナチュール診断</strong>です。</p><ul><li>9つの<wbr>質問に<wbr>答えるだけ。<wbr>約2分で<wbr>終わります</li><li>見るのは、<wbr>その<wbr>場その<wbr>場で<wbr>合わせている<wbr>顔ではなく、<strong><wbr>自然体の<wbr>あなた</strong>の<wbr>人との<wbr>関わり方です</li><li>8つの<wbr>タイプから<wbr>あなたを<wbr>最も<wbr>表すタイプが<wbr>表示されます</li></ul><p>自分の<wbr>関わり方が<wbr>わかると、<wbr>なぜ<wbr>自分だけが<wbr>どっと<wbr>疲れるのか、<wbr>その<wbr>手が<wbr>かりが<wbr>見えてきます。</p><p><strong><wbr>自分だけが<wbr>すり<wbr>減る<wbr>関係性を<wbr>終わりに<wbr>して、<wbr>自然体で<wbr>いられる<wbr>関係性を<wbr>始める。</strong></p><p>この<wbr>セミナーは、<wbr>その<wbr>ための<wbr>最初の<wbr>60分です。</p>"
      },
      {
        "kind": "text",
        "heading": "当日の流れ",
        "eyebrow": "",
        "fill": false,
        "html": "<ol><li><strong>ナチュール診断を<wbr>受ける</strong><wbr> その<wbr>場であなたの<wbr>タイプが<wbr>わかります</li><li><strong><wbr>自然体の<wbr>あなたを<wbr>読み解く</strong><wbr> ふだんの<wbr>あなたが、<wbr>人と<wbr>どう<wbr>関わっているのか</li><li><strong><wbr>「自分が<wbr>悪い」の<wbr>正体</strong> そう<wbr>感じる<wbr>場面で、<wbr>実際には<wbr>何が<wbr>起きているのか</li><li><strong><wbr>ひとりで<wbr>抜け出しに<wbr>くい理由</strong> ひとりで<wbr>考えても、<wbr>同じ<wbr>悩みに<wbr>戻ってしまうわけ</li><li><strong>どうやったら<wbr>解決できるか</strong><wbr> 診断結果を<wbr>もとに、<wbr>一人<wbr>ひとりが<wbr>どう<wbr>解決できるかを<wbr>解説</li></ol>"
      },
      {
        "kind": "text",
        "heading": "顔出し・発言なしで参加OK",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>カメラは<wbr>オフの<wbr>ままで<wbr>大丈夫です</li><li>声に<wbr>出して<wbr>発言する<wbr>場面は<wbr>ありません<wbr>（チャットへの<wbr>書き込みを<wbr>お願いする<wbr>ことは<wbr>あります）</li><li>表示名は、<wbr>ニックネームで<wbr>構いません</li><li>診断の<wbr>結果を、<wbr>ほかの<wbr>参加者に<wbr>見せる<wbr>ことは<wbr>ありません</li><li>最後に<wbr>継続サポートと<wbr>体験セッションの<wbr>ご案内を<wbr>しますが、<wbr>申し込みは<wbr>任意です</li></ul>"
      },
      {
        "kind": "text",
        "heading": "転職を、すすめも止めもしません",
        "eyebrow": "",
        "fill": false,
        "html": "<p>辞めるか、<wbr>続けるか。<wbr>決めるのは、<wbr>あなたです。</p><p>ただ、<wbr>辞めたい<wbr>理由が<wbr>「会社」なのか、<wbr>「あの<wbr>人との<wbr>関係」なのか。<wbr>ここを<wbr>切り分けて<wbr>おくと、<wbr>どちらを<wbr>選ぶに<wbr>しても、<wbr>判断の<wbr>材料が<wbr>ひとつ<wbr>増えます。</p><p>※ハラスメントや<wbr>暴力を<wbr>受けている<wbr>場合は、<wbr>関わり方を<wbr>工夫するより<wbr>先に、<wbr>その<wbr>人から<wbr>距離を<wbr>取り、<wbr>社内外の<wbr>相談窓口を<wbr>頼ってください。<wbr>この<wbr>セミナーは、<wbr>その<wbr>代わりには<wbr>なりません。</p>"
      },
      {
        "kind": "speaker",
        "heading": "登壇者",
        "eyebrow": "",
        "fill": false,
        "html": "<p>プロコーチと<wbr>して、<wbr>心理学・脳科学・潜在意識・対人関係に<wbr>ついて<wbr>学び、<wbr>1000時間以上の<wbr>有償サポート経験を<wbr>経て、<wbr>ナチュール診断を<wbr>つくりました。</p><p>私自身、<wbr>不満を<wbr>自分の<wbr>中に<wbr>抱え込んでしまい、<wbr>自分が<wbr>我慢する<wbr>関係性に<wbr>悩み続けた<wbr>経験が<wbr>あります。</p><p>この<wbr>ナチュール診断には、<wbr>その<wbr>時の<wbr>苦しさから<wbr>解放される<wbr>人が<wbr>一人でも<wbr>増えて<wbr>欲しいと<wbr>いう<wbr>想いを<wbr>込めています。</p>"
      },
      {
        "kind": "overview",
        "heading": "開催概要",
        "eyebrow": "",
        "fill": true
      },
      {
        "kind": "faq",
        "heading": "よくあるご質問",
        "eyebrow": "",
        "fill": true,
        "items": [
          {
            "q": "事前に診断を受けておく必要はありますか？",
            "html": "<p>いいえ、<wbr>当日<wbr>その<wbr>場で<wbr>受けていただきます。<wbr>約2分で<wbr>終わるので、<wbr>準備は<wbr>いりません。<wbr>結果は<wbr>一度しか<wbr>表示されないため、<wbr>受けた<wbr>ことがある<wbr>方も、<wbr>当日もう<wbr>一度<wbr>受けてください。</p>",
            "text": "いいえ、当日その場で受けていただきます。約2分で終わるので、準備はいりません。結果は一度しか表示されないため、受けたことがある方も、当日もう一度受けてください。"
          },
          {
            "q": "途中で抜けても大丈夫ですか？",
            "html": "<p>大丈夫です。<wbr>途中からの<wbr>参加も、<wbr>途中での<wbr>退出も<wbr>できます。</p>",
            "text": "大丈夫です。途中からの参加も、途中での退出もできます。"
          },
          {
            "q": "必要なものはありますか？",
            "html": "<p>インターネットに<wbr>つながる<wbr>パソコンか、<wbr>スマートフォンが<wbr>あれば<wbr>参加できます。<wbr>Zoomを<wbr>使うので、<wbr>スマートフォンの<wbr>場合は<wbr>アプリを<wbr>入れておくと<wbr>スムーズです。</p>",
            "text": "インターネットにつながるパソコンか、スマートフォンがあれば参加できます。Zoomを使うので、スマートフォンの場合はアプリを入れておくとスムーズです。"
          },
          {
            "q": "売り込みはされませんか？",
            "html": "<p>最後に、<wbr>継続サポートと<wbr>体験セッション<wbr>（個別・60分・無料）の<wbr>ご案内を<wbr>します。<wbr>ただ、<wbr>申し込みは<wbr>任意です。<wbr>受けるか<wbr>どうかは、<wbr>ご自身で<wbr>決めてください。</p>",
            "text": "最後に、継続サポートと体験セッション（個別・60分・無料）のご案内をします。ただ、申し込みは任意です。受けるかどうかは、ご自身で決めてください。"
          },
          {
            "q": "職場以外の人間関係の悩みがあっても参加できますか？",
            "html": "<p>はい。<wbr>ナチュール診断が<wbr>映すのは、<wbr>職場での<wbr>顔ではなく、<wbr>自然体の<wbr>あなたの<wbr>関わり方です。<wbr>当日は<wbr>職場を<wbr>例に<wbr>お話ししますが、<wbr>家族や<wbr>友人との<wbr>関係にも<wbr>当てはめて<wbr>考えられます。</p><p>---</p>",
            "text": "はい。ナチュール診断が映すのは、職場での顔ではなく、自然体のあなたの関わり方です。当日は職場を例にお話ししますが、家族や友人との関係にも当てはめて考えられます。---"
          }
        ]
      }
    ],
    images: { hero: { data: img_sem_1010_hero, mime: 'image/jpeg', ext: 'jpg', width: 1920, height: 1080, version: 'b946ff7197' }, og: { data: img_sem_1010_og, mime: 'image/png', ext: 'png', width: 1200, height: 600, version: '34394fbca4' }, speaker: { data: img_sem_1010_speaker, mime: 'image/jpeg', ext: 'jpg', width: 480, height: 480, version: '4dc1073255' } },
  },
  "sem-1020": {
    "slug": "sem-1020",
    "title": "もう転職しようかな、と思ったら知ってほしい。転職して人間関係がうまくいく人がやっていること｜人間関係タイプ診断つきセミナー",
    "description": "転職しても、また同じような人間関係でしんどくなる。そんな方のための、60分の無料オンラインセミナーです。その場でナチュール診断を受け、「自分が悪い」と感じる場面で本当は何が起きているのかを読み解きます。顔出し・発言なしで参加できます。",
    "catchLines": [
      "もう",
      "転職しようかな、",
      "と思ったら",
      "知ってほしい。"
    ],
    "kicker": "人間関係タイプ診断つきセミナー",
    "headlineLines": [
      "転職して人間関係が",
      "うまくいく人が",
      "やっていること"
    ],
    "subLines": [
      "あなたの周りに",
      "良い人が集まる",
      "関わり方"
    ],
    "date": "2026-10-20",
    "start": "21:00",
    "end": "22:00",
    "place": "オンライン",
    "placeNote": "Zoomで開催します。参加用のURLは、お申し込み後にPeatixからお送りします",
    "fee": "無料",
    "ticketUrl": "https://peatix.com/event/5202871",
    "ctaNote": "顔出し・発言なしで参加OK",
    "closing": "参加は無料です",
    "closingNote": "辞めるかどうか、まだ決めきれない。人に相談するのは、少し苦手。そんな方こそ、次の職場を探す前に、60分だけ自分の関わり方を見てみませんか。",
    "capacity": "10名（先着順）",
    "badges": [
      {
        "label": "所要時間",
        "value": "60分"
      },
      {
        "label": "参加費",
        "value": "無料"
      },
      {
        "label": "顔出し・発言",
        "value": "なしでOK"
      }
    ],
    "speakerName": "齋藤祐希",
    "speakerRole": "プロコーチ／ナチュール診断 開発者／Mikata 代表",
    "lead": "<p>転職しても<wbr>同じような<wbr>人間関係でしんどくなり、<wbr>また<wbr>転職を<wbr>考える。</p><p>自分らしく<wbr>活躍したいのに<wbr>できないのは、<wbr>あなたの<wbr>性格の<wbr>せいではありません。</p><p>その<wbr>場の<wbr>診断で<wbr>関わり方の<wbr>クセを<wbr>知り、<wbr>どこでも<wbr>伸び伸びと<wbr>働ける<wbr>本質を<wbr>お伝えします。</p>",
    "sections": [
      {
        "kind": "text",
        "heading": "こんなお悩み、ありませんか",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>転職しても、<wbr>なぜか<wbr>毎回、<wbr>苦手な<wbr>人が<wbr>いる</li><li>相手は<wbr>平気そうなのに、<wbr>自分だけが<wbr>どっと<wbr>疲れている</li><li>人と<wbr>うまく<wbr>いかないと、<wbr>「自分の<wbr>言い方が<wbr>悪かったのかな」と<wbr>何日も<wbr>引きずる</li><li>好き嫌いは<wbr>はっきり<wbr>あるのに、<wbr>顔には<wbr>出さずに<wbr>合わせている</li><li>本や<wbr>YouTubeで<wbr>調べて、<wbr>頭では<wbr>わかっている。<wbr>でも、<wbr>いざ<wbr>その<wbr>人の<wbr>前だと<wbr>うまく<wbr>できない</li><li>職場の<wbr>人間関係の<wbr>悩みを、<wbr>誰にも<wbr>相談できずに<wbr>いる</li><li>転職サイトを<wbr>開いては、<wbr>閉じている</li></ul>"
      },
      {
        "kind": "text",
        "heading": "それは、あなたの性格のせいではありません",
        "eyebrow": "",
        "fill": false,
        "html": "<p>人間関係が<wbr>うまく<wbr>いくかどうかは、<wbr>性格の<wbr>良し悪しでは<wbr>決まりません。</p><p>こちらの<wbr>気づかいが、<wbr>相手には<wbr>違う形で<wbr>伝わる<wbr>ことがあります。</p><figure class=\"lp-illust\" role=\"img\" aria-label=\"気をつかって黙っていたのに、「何を考えているかわからない人」と思われることもあります。\" data-illust=\"silence\" data-labels=\"気をつかって、／黙っておこう|何を考えているのか、／わからない…\"></figure><p>すれ違いのもとは、<wbr>性格<wbr>その<wbr>ものではなく、<strong><wbr>関わり方の<wbr>クセ</strong>に<wbr>あることが<wbr>よく<wbr>あります。<wbr>だから<wbr>職場を<wbr>変えても、<wbr>同じ<wbr>クセの<wbr>ままで<wbr>いると、<wbr>同じことがくり返されます。</p><p>クセは、<wbr>欠点ではありません。<wbr>自分が<wbr>どんな<wbr>クセで<wbr>人と<wbr>関わっているのかが<wbr>わかれば、<wbr>「自分が<wbr>悪い」の<wbr>ひと言で<wbr>片づけずに<wbr>済みます。</p>"
      },
      {
        "kind": "text",
        "heading": "本や性格診断では、足りなかった理由",
        "eyebrow": "",
        "fill": true,
        "html": "<p><strong>本や<wbr>YouTube</strong>に<wbr>書いてあるのは、<wbr>誰に<wbr>でも<wbr>当ては<wbr>まる<wbr>一般論です。<wbr>あなた<wbr>自身の<wbr>関わり方に<wbr>合わせた<wbr>答えではありません。</p><p><strong><wbr>性格診断</strong>で<wbr>わかるのは、<wbr>あなたが<wbr>どんな<wbr>性格か、<wbr>までです。<wbr>人と<wbr>どう<wbr>関わっているのか、<wbr>どこですれ違いやすいのかまでは、<wbr>教えてくれません。</p><p>そして、<strong><wbr>自分の<wbr>関わり方の<wbr>クセ</strong>は、<wbr>自分ではなかなか<wbr>気づけません。<wbr>知っているだけでは<wbr>変わらないのは、<wbr>この<wbr>ためです。</p>"
      },
      {
        "kind": "text",
        "heading": "すり減る関係から、抜け出すには",
        "eyebrow": "",
        "fill": false,
        "html": "<p>まず、<wbr>自分が<wbr>ふだん<wbr>どんな<wbr>ふうに<wbr>人と<wbr>関わっているのかを<wbr>知る<wbr>ことから<wbr>始めます。</p><p>その<wbr>ために<wbr>使うのが、<wbr>あなたの<wbr>人間関係タイプを<wbr>特定する<strong><wbr>ナチュール診断</strong>です。</p><ul><li>9つの<wbr>質問に<wbr>答えるだけ。<wbr>約2分で<wbr>終わります</li><li>見るのは、<wbr>その<wbr>場その<wbr>場で<wbr>合わせている<wbr>顔ではなく、<strong><wbr>自然体の<wbr>あなた</strong>の<wbr>人との<wbr>関わり方です</li><li>8つの<wbr>タイプから<wbr>あなたを<wbr>最も<wbr>表すタイプが<wbr>表示されます</li></ul><p>自分の<wbr>関わり方が<wbr>わかると、<wbr>なぜ<wbr>自分だけが<wbr>どっと<wbr>疲れるのか、<wbr>その<wbr>手が<wbr>かりが<wbr>見えてきます。</p><p><strong><wbr>自分だけが<wbr>すり<wbr>減る<wbr>関係性を<wbr>終わりに<wbr>して、<wbr>自然体で<wbr>いられる<wbr>関係性を<wbr>始める。</strong></p><p>この<wbr>セミナーは、<wbr>その<wbr>ための<wbr>最初の<wbr>60分です。</p>"
      },
      {
        "kind": "text",
        "heading": "当日の流れ",
        "eyebrow": "",
        "fill": false,
        "html": "<ol><li><strong>ナチュール診断を<wbr>受ける</strong><wbr> その<wbr>場であなたの<wbr>タイプが<wbr>わかります</li><li><strong><wbr>自然体の<wbr>あなたを<wbr>読み解く</strong><wbr> ふだんの<wbr>あなたが、<wbr>人と<wbr>どう<wbr>関わっているのか</li><li><strong><wbr>「自分が<wbr>悪い」の<wbr>正体</strong> そう<wbr>感じる<wbr>場面で、<wbr>実際には<wbr>何が<wbr>起きているのか</li><li><strong><wbr>ひとりで<wbr>抜け出しに<wbr>くい理由</strong> ひとりで<wbr>考えても、<wbr>同じ<wbr>悩みに<wbr>戻ってしまうわけ</li><li><strong>どうやったら<wbr>解決できるか</strong><wbr> 診断結果を<wbr>もとに、<wbr>一人<wbr>ひとりが<wbr>どう<wbr>解決できるかを<wbr>解説</li></ol>"
      },
      {
        "kind": "text",
        "heading": "顔出し・発言なしで参加OK",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>カメラは<wbr>オフの<wbr>ままで<wbr>大丈夫です</li><li>声に<wbr>出して<wbr>発言する<wbr>場面は<wbr>ありません<wbr>（チャットへの<wbr>書き込みを<wbr>お願いする<wbr>ことは<wbr>あります）</li><li>表示名は、<wbr>ニックネームで<wbr>構いません</li><li>診断の<wbr>結果を、<wbr>ほかの<wbr>参加者に<wbr>見せる<wbr>ことは<wbr>ありません</li><li>最後に<wbr>継続サポートと<wbr>体験セッションの<wbr>ご案内を<wbr>しますが、<wbr>申し込みは<wbr>任意です</li></ul>"
      },
      {
        "kind": "text",
        "heading": "転職を、すすめも止めもしません",
        "eyebrow": "",
        "fill": false,
        "html": "<p>辞めるか、<wbr>続けるか。<wbr>決めるのは、<wbr>あなたです。</p><p>ただ、<wbr>辞めたい<wbr>理由が<wbr>「会社」なのか、<wbr>「あの<wbr>人との<wbr>関係」なのか。<wbr>ここを<wbr>切り分けて<wbr>おくと、<wbr>どちらを<wbr>選ぶに<wbr>しても、<wbr>判断の<wbr>材料が<wbr>ひとつ<wbr>増えます。</p><p>※ハラスメントや<wbr>暴力を<wbr>受けている<wbr>場合は、<wbr>関わり方を<wbr>工夫するより<wbr>先に、<wbr>その<wbr>人から<wbr>距離を<wbr>取り、<wbr>社内外の<wbr>相談窓口を<wbr>頼ってください。<wbr>この<wbr>セミナーは、<wbr>その<wbr>代わりには<wbr>なりません。</p>"
      },
      {
        "kind": "speaker",
        "heading": "登壇者",
        "eyebrow": "",
        "fill": false,
        "html": "<p>プロコーチと<wbr>して、<wbr>心理学・脳科学・潜在意識・対人関係に<wbr>ついて<wbr>学び、<wbr>1000時間以上の<wbr>有償サポート経験を<wbr>経て、<wbr>ナチュール診断を<wbr>つくりました。</p><p>私自身、<wbr>不満を<wbr>自分の<wbr>中に<wbr>抱え込んでしまい、<wbr>自分が<wbr>我慢する<wbr>関係性に<wbr>悩み続けた<wbr>経験が<wbr>あります。</p><p>この<wbr>ナチュール診断には、<wbr>その<wbr>時の<wbr>苦しさから<wbr>解放される<wbr>人が<wbr>一人でも<wbr>増えて<wbr>欲しいと<wbr>いう<wbr>想いを<wbr>込めています。</p>"
      },
      {
        "kind": "overview",
        "heading": "開催概要",
        "eyebrow": "",
        "fill": true
      },
      {
        "kind": "faq",
        "heading": "よくあるご質問",
        "eyebrow": "",
        "fill": true,
        "items": [
          {
            "q": "事前に診断を受けておく必要はありますか？",
            "html": "<p>いいえ、<wbr>当日<wbr>その<wbr>場で<wbr>受けていただきます。<wbr>約2分で<wbr>終わるので、<wbr>準備は<wbr>いりません。<wbr>結果は<wbr>一度しか<wbr>表示されないため、<wbr>受けた<wbr>ことがある<wbr>方も、<wbr>当日もう<wbr>一度<wbr>受けてください。</p>",
            "text": "いいえ、当日その場で受けていただきます。約2分で終わるので、準備はいりません。結果は一度しか表示されないため、受けたことがある方も、当日もう一度受けてください。"
          },
          {
            "q": "途中で抜けても大丈夫ですか？",
            "html": "<p>大丈夫です。<wbr>途中からの<wbr>参加も、<wbr>途中での<wbr>退出も<wbr>できます。</p>",
            "text": "大丈夫です。途中からの参加も、途中での退出もできます。"
          },
          {
            "q": "必要なものはありますか？",
            "html": "<p>インターネットに<wbr>つながる<wbr>パソコンか、<wbr>スマートフォンが<wbr>あれば<wbr>参加できます。<wbr>Zoomを<wbr>使うので、<wbr>スマートフォンの<wbr>場合は<wbr>アプリを<wbr>入れておくと<wbr>スムーズです。</p>",
            "text": "インターネットにつながるパソコンか、スマートフォンがあれば参加できます。Zoomを使うので、スマートフォンの場合はアプリを入れておくとスムーズです。"
          },
          {
            "q": "売り込みはされませんか？",
            "html": "<p>最後に、<wbr>継続サポートと<wbr>体験セッション<wbr>（個別・60分・無料）の<wbr>ご案内を<wbr>します。<wbr>ただ、<wbr>申し込みは<wbr>任意です。<wbr>受けるか<wbr>どうかは、<wbr>ご自身で<wbr>決めてください。</p>",
            "text": "最後に、継続サポートと体験セッション（個別・60分・無料）のご案内をします。ただ、申し込みは任意です。受けるかどうかは、ご自身で決めてください。"
          },
          {
            "q": "職場以外の人間関係の悩みがあっても参加できますか？",
            "html": "<p>はい。<wbr>ナチュール診断が<wbr>映すのは、<wbr>職場での<wbr>顔ではなく、<wbr>自然体の<wbr>あなたの<wbr>関わり方です。<wbr>当日は<wbr>職場を<wbr>例に<wbr>お話ししますが、<wbr>家族や<wbr>友人との<wbr>関係にも<wbr>当てはめて<wbr>考えられます。</p><p>---</p>",
            "text": "はい。ナチュール診断が映すのは、職場での顔ではなく、自然体のあなたの関わり方です。当日は職場を例にお話ししますが、家族や友人との関係にも当てはめて考えられます。---"
          }
        ]
      }
    ],
    images: { hero: { data: img_sem_1020_hero, mime: 'image/jpeg', ext: 'jpg', width: 1920, height: 1080, version: 'b946ff7197' }, og: { data: img_sem_1020_og, mime: 'image/png', ext: 'png', width: 1200, height: 600, version: 'f71a1b3504' }, speaker: { data: img_sem_1020_speaker, mime: 'image/jpeg', ext: 'jpg', width: 480, height: 480, version: '4dc1073255' } },
  },
  "sem-1026": {
    "slug": "sem-1026",
    "title": "転職する前に知りたかった。「自分が悪い」と思ってしまうクセのやめ方｜人間関係タイプ診断つきセミナー",
    "description": "転職しても、また同じような人間関係でしんどくなる。そんな方のための、60分の無料オンラインセミナーです。その場でナチュール診断を受け、「自分が悪い」と感じる場面で本当は何が起きているのかを読み解きます。顔出し・発言なしで参加できます。",
    "catchLines": [
      "転職する前に、",
      "知りたかった。"
    ],
    "kicker": "人間関係タイプ診断つきセミナー",
    "headlineLines": [
      "「自分が悪い」",
      "と思ってしまうクセの",
      "やめ方"
    ],
    "subLines": [
      "性格診断だけでは作れない",
      "自然体でいられる関係"
    ],
    "date": "2026-10-26",
    "start": "21:00",
    "end": "22:00",
    "place": "オンライン",
    "placeNote": "Zoomで開催します。参加用のURLは、お申し込み後にPeatixからお送りします",
    "fee": "無料",
    "ticketUrl": "https://peatix.com/event/5212129",
    "ctaNote": "顔出し・発言なしで参加OK",
    "closing": "参加は無料です",
    "closingNote": "辞めるかどうか、まだ決めきれない。人に相談するのは、少し苦手。そんな方こそ、次の職場を探す前に、60分だけ自分の関わり方を見てみませんか。",
    "capacity": "10名（先着順）",
    "badges": [
      {
        "label": "所要時間",
        "value": "60分"
      },
      {
        "label": "参加費",
        "value": "無料"
      },
      {
        "label": "顔出し・発言",
        "value": "なしでOK"
      }
    ],
    "speakerName": "齋藤祐希",
    "speakerRole": "プロコーチ／ナチュール診断 開発者／Mikata 代表",
    "lead": "<p>転職しても<wbr>同じような<wbr>人間関係でしんどくなり、<wbr>その<wbr>たびに<wbr>「自分が<wbr>悪いのかな」と<wbr>考えてしまう。</p><p>その<wbr>原因は<wbr>性格ではなく、<wbr>自分では<wbr>気づきにくい<wbr>関わり方の<wbr>クセに<wbr>あり、<wbr>本や<wbr>性格診断では<wbr>見えてきません。</p><p>その<wbr>場の<wbr>診断で<wbr>自分の<wbr>関わり方の<wbr>クセを<wbr>知り、<wbr>どうすれば<wbr>抜け出せるかまでを<wbr>解説します。</p>",
    "sections": [
      {
        "kind": "text",
        "heading": "こんなお悩み、ありませんか",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>転職しても、<wbr>なぜか<wbr>毎回、<wbr>苦手な<wbr>人が<wbr>いる</li><li>相手は<wbr>平気そうなのに、<wbr>自分だけが<wbr>どっと<wbr>疲れている</li><li>人と<wbr>うまく<wbr>いかないと、<wbr>「自分の<wbr>言い方が<wbr>悪かったのかな」と<wbr>何日も<wbr>引きずる</li><li>好き嫌いは<wbr>はっきり<wbr>あるのに、<wbr>顔には<wbr>出さずに<wbr>合わせている</li><li>本や<wbr>YouTubeで<wbr>調べて、<wbr>頭では<wbr>わかっている。<wbr>でも、<wbr>いざ<wbr>その<wbr>人の<wbr>前だと<wbr>うまく<wbr>できない</li><li>職場の<wbr>人間関係の<wbr>悩みを、<wbr>誰にも<wbr>相談できずに<wbr>いる</li><li>転職サイトを<wbr>開いては、<wbr>閉じている</li></ul>"
      },
      {
        "kind": "text",
        "heading": "それは、あなたの性格のせいではありません",
        "eyebrow": "",
        "fill": false,
        "html": "<p>人間関係が<wbr>うまく<wbr>いくかどうかは、<wbr>性格の<wbr>良し悪しでは<wbr>決まりません。</p><p>こちらの<wbr>気づかいが、<wbr>相手には<wbr>違う形で<wbr>伝わる<wbr>ことがあります。</p><figure class=\"lp-illust\" role=\"img\" aria-label=\"気をつかって黙っていたのに、「何を考えているかわからない人」と思われることもあります。\" data-illust=\"silence\" data-labels=\"気をつかって、／黙っておこう|何を考えているのか、／わからない…\"></figure><p>すれ違いのもとは、<wbr>性格<wbr>その<wbr>ものではなく、<strong><wbr>関わり方の<wbr>クセ</strong>に<wbr>あることが<wbr>よく<wbr>あります。<wbr>だから<wbr>職場を<wbr>変えても、<wbr>同じ<wbr>クセの<wbr>ままで<wbr>いると、<wbr>同じことがくり返されます。</p><p>クセは、<wbr>欠点ではありません。<wbr>自分が<wbr>どんな<wbr>クセで<wbr>人と<wbr>関わっているのかが<wbr>わかれば、<wbr>「自分が<wbr>悪い」の<wbr>ひと言で<wbr>片づけずに<wbr>済みます。</p>"
      },
      {
        "kind": "text",
        "heading": "本や性格診断では、足りなかった理由",
        "eyebrow": "",
        "fill": true,
        "html": "<p><strong>本や<wbr>YouTube</strong>に<wbr>書いてあるのは、<wbr>誰に<wbr>でも<wbr>当ては<wbr>まる<wbr>一般論です。<wbr>あなた<wbr>自身の<wbr>関わり方に<wbr>合わせた<wbr>答えではありません。</p><p><strong><wbr>性格診断</strong>で<wbr>わかるのは、<wbr>あなたが<wbr>どんな<wbr>性格か、<wbr>までです。<wbr>人と<wbr>どう<wbr>関わっているのか、<wbr>どこですれ違いやすいのかまでは、<wbr>教えてくれません。</p><p>そして、<strong><wbr>自分の<wbr>関わり方の<wbr>クセ</strong>は、<wbr>自分ではなかなか<wbr>気づけません。<wbr>知っているだけでは<wbr>変わらないのは、<wbr>この<wbr>ためです。</p>"
      },
      {
        "kind": "text",
        "heading": "すり減る関係から、抜け出すには",
        "eyebrow": "",
        "fill": false,
        "html": "<p>まず、<wbr>自分が<wbr>ふだん<wbr>どんな<wbr>ふうに<wbr>人と<wbr>関わっているのかを<wbr>知る<wbr>ことから<wbr>始めます。</p><p>その<wbr>ために<wbr>使うのが、<wbr>あなたの<wbr>人間関係タイプを<wbr>特定する<strong><wbr>ナチュール診断</strong>です。</p><ul><li>9つの<wbr>質問に<wbr>答えるだけ。<wbr>約2分で<wbr>終わります</li><li>見るのは、<wbr>その<wbr>場その<wbr>場で<wbr>合わせている<wbr>顔ではなく、<strong><wbr>自然体の<wbr>あなた</strong>の<wbr>人との<wbr>関わり方です</li><li>8つの<wbr>タイプから<wbr>あなたを<wbr>最も<wbr>表すタイプが<wbr>表示されます</li></ul><p>自分の<wbr>関わり方が<wbr>わかると、<wbr>なぜ<wbr>自分だけが<wbr>どっと<wbr>疲れるのか、<wbr>その<wbr>手が<wbr>かりが<wbr>見えてきます。</p><p><strong><wbr>自分だけが<wbr>すり<wbr>減る<wbr>関係性を<wbr>終わりに<wbr>して、<wbr>自然体で<wbr>いられる<wbr>関係性を<wbr>始める。</strong></p><p>この<wbr>セミナーは、<wbr>その<wbr>ための<wbr>最初の<wbr>60分です。</p>"
      },
      {
        "kind": "text",
        "heading": "当日の流れ",
        "eyebrow": "",
        "fill": false,
        "html": "<ol><li><strong>ナチュール診断を<wbr>受ける</strong><wbr> その<wbr>場であなたの<wbr>タイプが<wbr>わかります</li><li><strong><wbr>自然体の<wbr>あなたを<wbr>読み解く</strong><wbr> ふだんの<wbr>あなたが、<wbr>人と<wbr>どう<wbr>関わっているのか</li><li><strong><wbr>「自分が<wbr>悪い」の<wbr>正体</strong> そう<wbr>感じる<wbr>場面で、<wbr>実際には<wbr>何が<wbr>起きているのか</li><li><strong><wbr>ひとりで<wbr>抜け出しに<wbr>くい理由</strong> ひとりで<wbr>考えても、<wbr>同じ<wbr>悩みに<wbr>戻ってしまうわけ</li><li><strong>どうやったら<wbr>解決できるか</strong><wbr> 診断結果を<wbr>もとに、<wbr>一人<wbr>ひとりが<wbr>どう<wbr>解決できるかを<wbr>解説</li></ol>"
      },
      {
        "kind": "text",
        "heading": "顔出し・発言なしで参加OK",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>カメラは<wbr>オフの<wbr>ままで<wbr>大丈夫です</li><li>声に<wbr>出して<wbr>発言する<wbr>場面は<wbr>ありません<wbr>（チャットへの<wbr>書き込みを<wbr>お願いする<wbr>ことは<wbr>あります）</li><li>表示名は、<wbr>ニックネームで<wbr>構いません</li><li>診断の<wbr>結果を、<wbr>ほかの<wbr>参加者に<wbr>見せる<wbr>ことは<wbr>ありません</li><li>最後に<wbr>継続サポートと<wbr>体験セッションの<wbr>ご案内を<wbr>しますが、<wbr>申し込みは<wbr>任意です</li></ul>"
      },
      {
        "kind": "text",
        "heading": "転職を、すすめも止めもしません",
        "eyebrow": "",
        "fill": false,
        "html": "<p>辞めるか、<wbr>続けるか。<wbr>決めるのは、<wbr>あなたです。</p><p>ただ、<wbr>辞めたい<wbr>理由が<wbr>「会社」なのか、<wbr>「あの<wbr>人との<wbr>関係」なのか。<wbr>ここを<wbr>切り分けて<wbr>おくと、<wbr>どちらを<wbr>選ぶに<wbr>しても、<wbr>判断の<wbr>材料が<wbr>ひとつ<wbr>増えます。</p><p>※ハラスメントや<wbr>暴力を<wbr>受けている<wbr>場合は、<wbr>関わり方を<wbr>工夫するより<wbr>先に、<wbr>その<wbr>人から<wbr>距離を<wbr>取り、<wbr>社内外の<wbr>相談窓口を<wbr>頼ってください。<wbr>この<wbr>セミナーは、<wbr>その<wbr>代わりには<wbr>なりません。</p>"
      },
      {
        "kind": "speaker",
        "heading": "登壇者",
        "eyebrow": "",
        "fill": false,
        "html": "<p>プロコーチと<wbr>して、<wbr>心理学・脳科学・潜在意識・対人関係に<wbr>ついて<wbr>学び、<wbr>1000時間以上の<wbr>有償サポート経験を<wbr>経て、<wbr>ナチュール診断を<wbr>つくりました。</p><p>私自身、<wbr>不満を<wbr>自分の<wbr>中に<wbr>抱え込んでしまい、<wbr>自分が<wbr>我慢する<wbr>関係性に<wbr>悩み続けた<wbr>経験が<wbr>あります。</p><p>この<wbr>ナチュール診断には、<wbr>その<wbr>時の<wbr>苦しさから<wbr>解放される<wbr>人が<wbr>一人でも<wbr>増えて<wbr>欲しいと<wbr>いう<wbr>想いを<wbr>込めています。</p>"
      },
      {
        "kind": "overview",
        "heading": "開催概要",
        "eyebrow": "",
        "fill": true
      },
      {
        "kind": "faq",
        "heading": "よくあるご質問",
        "eyebrow": "",
        "fill": true,
        "items": [
          {
            "q": "事前に診断を受けておく必要はありますか？",
            "html": "<p>いいえ、<wbr>当日<wbr>その<wbr>場で<wbr>受けていただきます。<wbr>約2分で<wbr>終わるので、<wbr>準備は<wbr>いりません。<wbr>結果は<wbr>一度しか<wbr>表示されないため、<wbr>受けた<wbr>ことがある<wbr>方も、<wbr>当日もう<wbr>一度<wbr>受けてください。</p>",
            "text": "いいえ、当日その場で受けていただきます。約2分で終わるので、準備はいりません。結果は一度しか表示されないため、受けたことがある方も、当日もう一度受けてください。"
          },
          {
            "q": "途中で抜けても大丈夫ですか？",
            "html": "<p>大丈夫です。<wbr>途中からの<wbr>参加も、<wbr>途中での<wbr>退出も<wbr>できます。</p>",
            "text": "大丈夫です。途中からの参加も、途中での退出もできます。"
          },
          {
            "q": "必要なものはありますか？",
            "html": "<p>インターネットに<wbr>つながる<wbr>パソコンか、<wbr>スマートフォンが<wbr>あれば<wbr>参加できます。<wbr>Zoomを<wbr>使うので、<wbr>スマートフォンの<wbr>場合は<wbr>アプリを<wbr>入れておくと<wbr>スムーズです。</p>",
            "text": "インターネットにつながるパソコンか、スマートフォンがあれば参加できます。Zoomを使うので、スマートフォンの場合はアプリを入れておくとスムーズです。"
          },
          {
            "q": "売り込みはされませんか？",
            "html": "<p>最後に、<wbr>継続サポートと<wbr>体験セッション<wbr>（個別・60分・無料）の<wbr>ご案内を<wbr>します。<wbr>ただ、<wbr>申し込みは<wbr>任意です。<wbr>受けるか<wbr>どうかは、<wbr>ご自身で<wbr>決めてください。</p>",
            "text": "最後に、継続サポートと体験セッション（個別・60分・無料）のご案内をします。ただ、申し込みは任意です。受けるかどうかは、ご自身で決めてください。"
          },
          {
            "q": "職場以外の人間関係の悩みがあっても参加できますか？",
            "html": "<p>はい。<wbr>ナチュール診断が<wbr>映すのは、<wbr>職場での<wbr>顔ではなく、<wbr>自然体の<wbr>あなたの<wbr>関わり方です。<wbr>当日は<wbr>職場を<wbr>例に<wbr>お話ししますが、<wbr>家族や<wbr>友人との<wbr>関係にも<wbr>当てはめて<wbr>考えられます。</p><p>---</p>",
            "text": "はい。ナチュール診断が映すのは、職場での顔ではなく、自然体のあなたの関わり方です。当日は職場を例にお話ししますが、家族や友人との関係にも当てはめて考えられます。---"
          }
        ]
      }
    ],
    images: { hero: { data: img_sem_1026_hero, mime: 'image/jpeg', ext: 'jpg', width: 1920, height: 1080, version: 'b946ff7197' }, og: { data: img_sem_1026_og, mime: 'image/png', ext: 'png', width: 1200, height: 600, version: 'dce6c5b7ca' }, speaker: { data: img_sem_1026_speaker, mime: 'image/jpeg', ext: 'jpg', width: 480, height: 480, version: '4dc1073255' } },
  },
  "sem-1111": {
    "slug": "sem-1111",
    "title": "スキマ時間で稼ぐ力の身につけ方｜会社員のまま始める、副業セミナー（ワークショップ付き）",
    "description": "「時間がない」を言い訳にしたくない会社員のための、60分の無料オンライン副業セミナー（ワークショップ付き）です。AIを活用して、自分の強みから商品を作る最初の一歩を、その場で踏み出せます。顔出し・発言なしで参加できます。",
    "catchLines": [
      "この先も、",
      "今の働き方で",
      "大丈夫かな。"
    ],
    "kicker": "会社員のまま始める、副業セミナー（ワークショップ付き）",
    "headlineLines": [
      "スキマ時間で",
      "稼ぐ力の",
      "身につけ方"
    ],
    "subLines": [
      "「時間がない」を、",
      "言い訳にしない",
      "効率的な副業の始め方"
    ],
    "date": "2026-11-11",
    "start": "21:00",
    "end": "22:00",
    "place": "オンライン",
    "placeNote": "Zoomで開催します。参加用のURLは、お申し込み後にPeatixからお送りします",
    "fee": "無料",
    "ticketUrl": "https://peatix.com/event/5255773",
    "ctaNote": "顔出し・発言なしで参加OK",
    "closing": "参加は無料です",
    "closingNote": "毎日忙しくて、何から始めればいいか分からない。一人だと、つい後回しにしてしまう。そんな方こそ、60分だけ、一緒に手を動かしてみませんか。",
    "capacity": "10名（先着順）",
    "badges": [
      {
        "label": "所要時間",
        "value": "60分"
      },
      {
        "label": "参加費",
        "value": "無料"
      },
      {
        "label": "顔出し・発言",
        "value": "なしでOK"
      }
    ],
    "speakerName": "齋藤祐希",
    "speakerRole": "プロコーチ／Mikata 代表",
    "lead": "<p>「時間が<wbr>ない」を<wbr>言い訳に<wbr>したくないのに、<wbr>副業を<wbr>始められないまま、<wbr>今日も<wbr>一日が<wbr>終わっていく。</p><p>副業の<wbr>ことを<wbr>いくら<wbr>調べても、<wbr>自分は<wbr>何から<wbr>始めればいいのかが<wbr>分からず、<wbr>一人では<wbr>手が<wbr>止まっていませんか？</p><p>この<wbr>セミナーでは、<wbr>時間が<wbr>なくても<wbr>副業で<wbr>結果が<wbr>出ている<wbr>人が<wbr>実践している<wbr>ことを、<wbr>その<wbr>場で<wbr>体験し、<wbr>最初の<wbr>一歩を<wbr>踏み出しましょう。</p>",
    "sections": [
      {
        "kind": "text",
        "heading": "こんなお悩み、ありませんか",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>この<wbr>先も、<wbr>今の<wbr>働き方を<wbr>続けていけるのか<wbr>分からない</li><li>いつか<wbr>仕事を<wbr>失うのかと、<wbr>不安になってしまう</li><li>会社だけに<wbr>頼らず、<wbr>自分の<wbr>力でも<wbr>稼げるようになりたい</li><li>仕事と<wbr>家の<wbr>ことで、<wbr>平日は<wbr>自分の<wbr>時間が<wbr>ほとんど<wbr>残らない</li><li>副業の<wbr>広告が<wbr>流れてくると、<wbr>つい<wbr>開いてしまう。<wbr>でも、<wbr>まだ<wbr>何も<wbr>始められていない</li><li>自分に、<wbr>お金を<wbr>いただけるような<wbr>強みが<wbr>あるのか<wbr>分からない</li></ul>"
      },
      {
        "kind": "text",
        "heading": "多くの人がやろうと思っても自分の名前で稼げない理由",
        "eyebrow": "",
        "fill": true,
        "html": "<p>自分の<wbr>名前で<wbr>稼ごうと<wbr>思った<wbr>とき、<wbr>多くの<wbr>人は<wbr>まず、<wbr>スキルや<wbr>ノウハウを<wbr>手に<wbr>入れようとします。<wbr>動画を<wbr>見て、<wbr>本を<wbr>読んで、<wbr>やり方を<wbr>調べる。</p><p>でも、<wbr>スキルや<wbr>ノウハウを<wbr>いくら集めても、<wbr>それだけでは<wbr>結果に<wbr>つながりません。</p><p>本当に<wbr>結果を<wbr>出している<wbr>人は、<wbr>この<wbr>セミナーで<wbr>お話しする<wbr>「ある<wbr>こと」を<wbr>守っています。</p><p>この<wbr>ポイントを<wbr>意識するだけで、<wbr>なぜ<wbr>今まで<wbr>副業で<wbr>結果が<wbr>出なかったのか、<wbr>なぜ<wbr>憧れの<wbr>あの<wbr>人のようになれないのかが<wbr>分かります。</p>"
      },
      {
        "kind": "text",
        "heading": "聞くだけで終わらない、ワークショップ付きの60分",
        "eyebrow": "",
        "fill": false,
        "html": "<p>AIを<wbr>活用して、<wbr>自分の<wbr>強みから<wbr>商品を<wbr>作ると<wbr>いう<wbr>最初の<wbr>一歩を<wbr>踏み出せます。<wbr>AIを<wbr>どう<wbr>使うかまで<wbr>丁寧に<wbr>解説するので、<wbr>AIを<wbr>使った<wbr>ことがない<wbr>人でも<wbr>大丈夫です。</p><p>一人では<wbr>後回しに<wbr>してきた<wbr>ことを、<wbr>この<wbr>60分で、<wbr>一緒に<wbr>形にします。<wbr>参加すると、<wbr>こんな<wbr>ものを<wbr>持ち帰れます。</p><ul><li>「自分にも<wbr>できそう」と<wbr>思える<wbr>手応え</li><li>限られた<wbr>時間の<wbr>中で、<wbr>来週から<wbr>動ける<wbr>見通し</li><li>どこでなぜ手が<wbr>止まりやすいのかの<wbr>気づき</li></ul>"
      },
      {
        "kind": "text",
        "heading": "目指すのは、こんな毎日",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>「時間が<wbr>ないから」を<wbr>言い訳に<wbr>せずに<wbr>済むようになる</li><li>お給料の<wbr>ほかにも、<wbr>自分で<wbr>得た<wbr>収入が<wbr>ある</li><li>この<wbr>先働き方が<wbr>変わっても、<wbr>稼ぐ<wbr>力が<wbr>手元に<wbr>ある</li><li>副業の<wbr>広告を<wbr>見ても、<wbr>もう<wbr>焦らない</li><li>自分の<wbr>強みで、<wbr>誰かの<wbr>役に<wbr>立てている</li></ul>"
      },
      {
        "kind": "text",
        "heading": "顔出し・発言なしで参加OK",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>カメラは<wbr>オフ、<wbr>マイクは<wbr>ミュートの<wbr>ままで<wbr>大丈夫です</li><li>声に<wbr>出して<wbr>発言する<wbr>場面は<wbr>ありません<wbr>（チャットへの<wbr>書き込みやリアクションを<wbr>お願いする<wbr>ことは<wbr>あります）</li><li>表示名は、<wbr>ニックネームで<wbr>構いません</li><li>ワークで<wbr>書いた<wbr>ことは、<wbr>誰にも<wbr>見せなくて<wbr>大丈夫です</li><li>最後に<wbr>継続サポートの<wbr>ご案内を<wbr>しますが、<wbr>申し込みは<wbr>任意です</li></ul>"
      },
      {
        "kind": "text",
        "heading": "ご用意いただくもの",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>インターネットに<wbr>つながる<wbr>パソコンか、<wbr>スマートフォン<wbr>（内容の<wbr>関係で、<wbr>パソコンでの<wbr>参加を<wbr>推奨しております）</li><li>AI<wbr>（Claude・ChatGPT・Gemini の<wbr>どれか<wbr>1つ）</li><li>メモ帳か<wbr>紙</li></ul>"
      },
      {
        "kind": "text",
        "heading": "最後まで参加した方へ、豪華プレゼント3点",
        "eyebrow": "",
        "fill": false,
        "html": "<p>最後まで<wbr>ご参加いただいた方に、<wbr>次の<wbr>3点を<wbr>プレゼントします。</p><p><strong><wbr>① 強み発掘AIプロンプト</strong></p><p>あなたの<wbr>経験から、<wbr>お金を<wbr>いただける<wbr>サービス案を<wbr>引き出す</p><p><strong>② 声かけ文面AIプロンプト</strong></p><p>お試しの<wbr>値段と、<wbr>売り込みに<wbr>見えない<wbr>声かけの<wbr>文面を<wbr>つくる</p><p><strong><wbr>③ 最初の<wbr>一歩ワークシート</strong></p><p>今日の<wbr>ワークを、<wbr>自分用の<wbr>シートで<wbr>続けられる<wbr>（1週間後に<wbr>見返す<wbr>欄つき）</p>"
      },
      {
        "kind": "speaker",
        "heading": "登壇者",
        "eyebrow": "",
        "fill": false,
        "html": "<p>エンジニアと<wbr>して<wbr>キャリアを<wbr>スタートし、<wbr>バリスタや<wbr>農家の<wbr>仕事も<wbr>経験してきました。<wbr>現在は<wbr>プロコーチと<wbr>して<wbr>活動しています。<wbr>エンジニア時代に<wbr>身に<wbr>つけた<wbr>仕組み化力と<wbr>AI活用の<wbr>実践経験、<wbr>コーチと<wbr>して<wbr>導く<wbr>力を<wbr>強みと<wbr>しています。</p><p>かつては<wbr>自分も、<wbr>会社の<wbr>看板が<wbr>ないと<wbr>通用しない<wbr>気が<wbr>して、<wbr>自分の<wbr>力で<wbr>稼ぐのが<wbr>怖かった<wbr>一人です。<wbr>今は<wbr>自分の<wbr>名前で<wbr>仕事が<wbr>生まれ、<wbr>働く<wbr>時間も<wbr>場所も<wbr>自分で<wbr>決めています。</p><p>これまで<wbr>100名以上の<wbr>方の<wbr>キャリアと<wbr>向き合い、<wbr>有償セッションの<wbr>経験は<wbr>2000時間を<wbr>超えます。</p>"
      },
      {
        "kind": "overview",
        "heading": "開催概要",
        "eyebrow": "",
        "fill": true
      },
      {
        "kind": "text",
        "heading": "開催条件",
        "eyebrow": "",
        "fill": false,
        "html": "<ul><li>お申し込みが<wbr>2名以上の<wbr>場合に<wbr>開催します</li><li>開催するか<wbr>どうかは、<wbr>前日の<wbr>11月10日<wbr>（火）<wbr>19:00までに<wbr>決定します</li><li>開催しない<wbr>場合は、<wbr>Peatix の<wbr>メッセージで<wbr>お知らせします</li><li>その<wbr>場合、<wbr>お申し込みは<wbr>キャンセルと<wbr>なります</li></ul>"
      },
      {
        "kind": "text",
        "heading": "キャンセルについて",
        "eyebrow": "",
        "fill": true,
        "html": "<p>無断で<wbr>キャンセルされた<wbr>方には、<wbr>今後の<wbr>イベントへの<wbr>ご参加を<wbr>お断りさせていただく<wbr>ことが<wbr>ございます。<wbr>あらかじめご了承ください。</p>"
      },
      {
        "kind": "faq",
        "heading": "よくあるご質問",
        "eyebrow": "",
        "fill": true,
        "items": [
          {
            "q": "何をやるか、まだ決まっていなくても参加できますか？",
            "html": "<p>はい。<wbr>決まっていない<wbr>方こそ、<wbr>お越しください。<wbr>ワークの<wbr>中で、<wbr>自分に<wbr>できそうな<wbr>ことから<wbr>考えていきます。</p>",
            "text": "はい。決まっていない方こそ、お越しください。ワークの中で、自分にできそうなことから考えていきます。"
          },
          {
            "q": "AIを使ったことがなくても大丈夫ですか？",
            "html": "<p>大丈夫です。<wbr>AIに<wbr>貼り付ける<wbr>文章は、<wbr>こちらで<wbr>用意しています。<wbr>Claude・ChatGPT・Gemini の<wbr>どれか<wbr>1つを、<wbr>すぐ<wbr>開ける<wbr>状態に<wbr>しておいてください。</p>",
            "text": "大丈夫です。AIに貼り付ける文章は、こちらで用意しています。Claude・ChatGPT・Gemini のどれか1つを、すぐ開ける状態にしておいてください。"
          },
          {
            "q": "会社を辞めるつもりはありませんが、参加できますか？",
            "html": "<p>はい。<wbr>会社員の<wbr>まま<wbr>始める<wbr>ことを<wbr>前提に<wbr>した<wbr>セミナーです。<wbr>辞める<wbr>ことを<wbr>おすすめする<wbr>内容ではありません。</p>",
            "text": "はい。会社員のまま始めることを前提にしたセミナーです。辞めることをおすすめする内容ではありません。"
          },
          {
            "q": "途中で抜けても大丈夫ですか？",
            "html": "<p>大丈夫です。<wbr>途中からの<wbr>参加も、<wbr>途中での<wbr>退出も<wbr>できます。<wbr>ただ、<wbr>プレゼント3点は、<wbr>最後まで<wbr>ご参加いただいた方に<wbr>お渡しします。</p>",
            "text": "大丈夫です。途中からの参加も、途中での退出もできます。ただ、プレゼント3点は、最後までご参加いただいた方にお渡しします。"
          },
          {
            "q": "売り込みはされませんか？",
            "html": "<p>はい、<wbr>売り込みは<wbr>致しませんが、<wbr>最後に<wbr>私が<wbr>提供している<wbr>継続サポートの<wbr>ご案内の<wbr>お時間を<wbr>いただいて<wbr>おります。</p>",
            "text": "はい、売り込みは致しませんが、最後に私が提供している継続サポートのご案内のお時間をいただいております。"
          }
        ]
      }
    ],
    images: { speaker: { data: img_sem_1111_speaker, mime: 'image/jpeg', ext: 'jpg', width: 480, height: 480, version: '4dc1073255' } },
  },
};
