// 自動生成。直接編集しない。
// 生成元：セミナーLP文面.md（文面と開催情報の正）と app/assets/seminar/{slug}/ の画像
// 再生成：cd app && npm run content
// /seminar/{slug} の中身（アプリ化要件定義.md F4-5「セミナーの告知ページ」）
import img_sem_1010_hero from '../../assets/seminar/sem-1010/hero.jpg';
import img_sem_1010_speaker from '../../assets/seminar/sem-1010/speaker.jpg';

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

/** eyebrow は見出しの上に小さく出す英字（無ければ空文字）。 */
export type SeminarSection =
  | { kind: 'text'; heading: string; eyebrow: string; html: string }
  | { kind: 'speaker'; heading: string; eyebrow: string; html: string }
  | { kind: 'overview'; heading: string; eyebrow: string }
  | { kind: 'faq'; heading: string; eyebrow: string; items: { q: string; html: string; text: string }[] };

export type Seminar = {
  slug: string;
  title: string;
  description: string;
  /** ファーストビューに手書き風の書体で出す一文。1要素が1行。 */
  catchLines: string[];
  /** 見出し。要素の切れ目で改行する（狭い画面でも）。 */
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
  "「自分が悪い」と思うのを": "「自分が<wbr>悪い」と<wbr>思うのを",
  "やめるための診断セミナー": "やめる<wbr>ための<wbr>診断セミナー",
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
  "職場以外の人間関係の悩みがあっても参加できますか？": "職場以外の<wbr>人間関係の<wbr>悩みが<wbr>あっても<wbr>参加できますか？"
};

export const SEMINARS: Record<string, Seminar> = {
  "sem-1010": {
    "slug": "sem-1010",
    "title": "転職する前に知りたかった。「自分が悪い」と思うのをやめるための診断セミナー",
    "description": "転職しても、また同じような人間関係でしんどくなる。そんな方のための、60分の無料オンラインセミナーです。その場でナチュール診断を受け、「自分が悪い」と感じる場面で本当は何が起きているのかを読み解きます。顔出し・発言なしで参加できます。",
    "catchLines": [
      "転職する前に、",
      "知りたかった。"
    ],
    "headlineLines": [
      "「自分が悪い」と思うのを",
      "やめるための診断セミナー"
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
    "lead": "<p>転職しても<wbr>同じような<wbr>人間関係でしんどくなり、<wbr>その<wbr>たびに<wbr>「自分が<wbr>悪いのかな」と<wbr>考えてしまう。</p><p>その<wbr>原因は<wbr>性格ではなく、<wbr>自分では<wbr>気づきにくい<wbr>関わり方の<wbr>クセに<wbr>あり、<wbr>本や<wbr>性格診断では<wbr>見えてきません。</p><p>その<wbr>場の<wbr>診断で<wbr>自分の<wbr>関わり方の<wbr>クセを<wbr>知り、<wbr>どうすれば<wbr>抜け出せるかまでを、<wbr>一人<wbr>ひとりの<wbr>結果から<wbr>解説します。</p>",
    "sections": [
      {
        "kind": "text",
        "heading": "こんなお悩み、ありませんか",
        "eyebrow": "",
        "html": "<ul><li>転職しても、<wbr>なぜか<wbr>毎回、<wbr>苦手な<wbr>人が<wbr>いる</li><li>相手は<wbr>平気そうなのに、<wbr>自分だけが<wbr>どっと<wbr>疲れている</li><li>人と<wbr>うまく<wbr>いかないと、<wbr>「自分の<wbr>言い方が<wbr>悪かったのかな」と<wbr>何日も<wbr>引きずる</li><li>好き嫌いは<wbr>はっきり<wbr>あるのに、<wbr>顔には<wbr>出さずに<wbr>合わせている</li><li>本や<wbr>YouTubeで<wbr>調べて、<wbr>頭では<wbr>わかっている。<wbr>でも、<wbr>いざ<wbr>その<wbr>人の<wbr>前だと<wbr>うまく<wbr>できない</li><li>職場の<wbr>人間関係の<wbr>悩みを、<wbr>誰にも<wbr>相談できずに<wbr>いる</li><li>転職サイトを<wbr>開いては、<wbr>閉じている</li></ul>"
      },
      {
        "kind": "text",
        "heading": "それは、あなたの性格のせいではありません",
        "eyebrow": "",
        "html": "<p>人間関係が<wbr>うまく<wbr>いくかどうかは、<wbr>性格の<wbr>良し悪しでは<wbr>決まりません。</p><p>こちらの<wbr>気づかいが、<wbr>相手には<wbr>違う形で<wbr>伝わる<wbr>ことがあります。</p><figure class=\"lp-illust\" role=\"img\" aria-label=\"気をつかって黙っていたのに、「何を考えているかわからない人」と思われることもあります。\" data-illust=\"silence\" data-labels=\"気をつかって、／黙っておこう|何を考えているのか、／わからない…\"></figure><p>すれ違いのもとは、<wbr>性格<wbr>その<wbr>ものではなく、<strong><wbr>関わり方の<wbr>クセ</strong>に<wbr>あることが<wbr>よく<wbr>あります。<wbr>だから<wbr>職場を<wbr>変えても、<wbr>同じ<wbr>クセの<wbr>ままで<wbr>いると、<wbr>同じことがくり返されます。</p><p>クセは、<wbr>欠点ではありません。<wbr>自分が<wbr>どんな<wbr>クセで<wbr>人と<wbr>関わっているのかが<wbr>わかれば、<wbr>「自分が<wbr>悪い」の<wbr>ひと言で<wbr>片づけずに<wbr>済みます。</p>"
      },
      {
        "kind": "text",
        "heading": "本や性格診断では、足りなかった理由",
        "eyebrow": "",
        "html": "<p><strong>本や<wbr>YouTube</strong>に<wbr>書いてあるのは、<wbr>誰に<wbr>でも<wbr>当ては<wbr>まる<wbr>一般論です。<wbr>あなた<wbr>自身の<wbr>関わり方に<wbr>合わせた<wbr>答えではありません。</p><p><strong><wbr>性格診断</strong>で<wbr>わかるのは、<wbr>あなたが<wbr>どんな<wbr>性格か、<wbr>までです。<wbr>人と<wbr>どう<wbr>関わっているのか、<wbr>どこですれ違いやすいのかまでは、<wbr>教えてくれません。</p><p>そして、<strong><wbr>自分の<wbr>関わり方の<wbr>クセ</strong>は、<wbr>自分ではなかなか<wbr>気づけません。<wbr>知っているだけでは<wbr>変わらないのは、<wbr>この<wbr>ためです。</p>"
      },
      {
        "kind": "text",
        "heading": "すり減る関係から、抜け出すには",
        "eyebrow": "",
        "html": "<p>まず、<wbr>自分が<wbr>ふだん<wbr>どんな<wbr>ふうに<wbr>人と<wbr>関わっているのかを<wbr>知る<wbr>ことから<wbr>始めます。</p><p>その<wbr>ために<wbr>使うのが、<strong><wbr>ナチュール診断</strong>です。</p><ul><li>9つの<wbr>質問に<wbr>答えるだけ。<wbr>約2分で<wbr>終わります</li><li>見るのは、<wbr>その<wbr>場その<wbr>場で<wbr>合わせている<wbr>顔ではなく、<strong><wbr>自然体の<wbr>あなた</strong>の<wbr>人との<wbr>関わり方です</li><li>8つの<wbr>タイプから<wbr>あなたを<wbr>最も<wbr>表すタイプが<wbr>表示されます</li></ul><p>自分の<wbr>関わり方が<wbr>わかると、<wbr>なぜ<wbr>自分だけが<wbr>どっと<wbr>疲れるのか、<wbr>その<wbr>手が<wbr>かりが<wbr>見えてきます。</p><p><strong><wbr>自分だけが<wbr>すり<wbr>減る<wbr>関係性を<wbr>終わりに<wbr>して、<wbr>自然体で<wbr>いられる<wbr>関係性を<wbr>始める。</strong></p><p>この<wbr>セミナーは、<wbr>その<wbr>ための<wbr>最初の<wbr>60分です。</p>"
      },
      {
        "kind": "text",
        "heading": "当日の流れ",
        "eyebrow": "",
        "html": "<ol><li><strong>その<wbr>場で<wbr>ナチュール診断</strong> 約2分。<wbr>登録は<wbr>いりません</li><li><strong><wbr>自然体の<wbr>あなたを<wbr>読み解く</strong><wbr> ふだんの<wbr>あなたが、<wbr>人と<wbr>どう<wbr>関わっているのか</li><li><strong><wbr>「自分が<wbr>悪い」の<wbr>正体</strong> そう<wbr>感じる<wbr>場面で、<wbr>実際には<wbr>何が<wbr>起きているのか</li><li><strong><wbr>ひとりで<wbr>抜け出しに<wbr>くい理由</strong> ひとりで<wbr>考えても、<wbr>同じ<wbr>悩みに<wbr>戻ってしまうわけ</li><li><strong>どうやったら<wbr>解決できるか</strong><wbr> 診断結果を<wbr>もとに、<wbr>一人<wbr>ひとりが<wbr>どう<wbr>解決できるかを<wbr>解説</li></ol>"
      },
      {
        "kind": "text",
        "heading": "顔出し・発言なしで参加OK",
        "eyebrow": "",
        "html": "<ul><li>カメラは<wbr>オフの<wbr>ままで<wbr>大丈夫です</li><li>声に<wbr>出して<wbr>発言する<wbr>場面は<wbr>ありません<wbr>（チャットへの<wbr>書き込みを<wbr>お願いする<wbr>ことは<wbr>あります）</li><li>表示名は、<wbr>ニックネームで<wbr>構いません</li><li>診断の<wbr>結果を、<wbr>ほかの<wbr>参加者に<wbr>見せる<wbr>ことは<wbr>ありません</li><li>最後に<wbr>継続サポートと<wbr>体験セッションの<wbr>ご案内を<wbr>しますが、<wbr>申し込みは<wbr>任意です</li></ul>"
      },
      {
        "kind": "text",
        "heading": "転職を、すすめも止めもしません",
        "eyebrow": "",
        "html": "<p>辞めるか、<wbr>続けるか。<wbr>決めるのは、<wbr>あなたです。</p><p>ただ、<wbr>辞めたい<wbr>理由が<wbr>「会社」なのか、<wbr>「あの<wbr>人との<wbr>関係」なのか。<wbr>ここを<wbr>切り分けて<wbr>おくと、<wbr>どちらを<wbr>選ぶに<wbr>しても、<wbr>判断の<wbr>材料が<wbr>ひとつ<wbr>増えます。</p><p>※ハラスメントや<wbr>暴力を<wbr>受けている<wbr>場合は、<wbr>関わり方を<wbr>工夫するより<wbr>先に、<wbr>その<wbr>人から<wbr>距離を<wbr>取り、<wbr>社内外の<wbr>相談窓口を<wbr>頼ってください。<wbr>この<wbr>セミナーは、<wbr>その<wbr>代わりには<wbr>なりません。</p>"
      },
      {
        "kind": "speaker",
        "heading": "登壇者",
        "eyebrow": "",
        "html": "<p>プロコーチと<wbr>して、<wbr>心理学・脳科学・潜在意識・対人関係に<wbr>ついて<wbr>学び、<wbr>1000時間以上の<wbr>有償サポート経験を<wbr>経て、<wbr>ナチュール診断を<wbr>つくりました。</p><p>私自身、<wbr>不満を<wbr>自分の<wbr>中に<wbr>抱え込んでしまい、<wbr>自分が<wbr>我慢する<wbr>関係性に<wbr>悩み続けた<wbr>経験が<wbr>あります。</p><p>この<wbr>ナチュール診断には、<wbr>その<wbr>時の<wbr>苦しさから<wbr>解放される<wbr>人が<wbr>一人でも<wbr>増えて<wbr>欲しいと<wbr>いう<wbr>想いを<wbr>込めています。</p>"
      },
      {
        "kind": "overview",
        "heading": "開催概要",
        "eyebrow": ""
      },
      {
        "kind": "faq",
        "heading": "よくあるご質問",
        "eyebrow": "",
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
            "html": "<p>はい。<wbr>ナチュール診断が<wbr>映すのは、<wbr>職場での<wbr>顔ではなく、<wbr>自然体の<wbr>あなたの<wbr>関わり方です。<wbr>当日は<wbr>職場を<wbr>例に<wbr>お話ししますが、<wbr>家族や<wbr>友人との<wbr>関係にも<wbr>当てはめて<wbr>考えられます。</p>",
            "text": "はい。ナチュール診断が映すのは、職場での顔ではなく、自然体のあなたの関わり方です。当日は職場を例にお話ししますが、家族や友人との関係にも当てはめて考えられます。"
          }
        ]
      }
    ],
    images: { hero: { data: img_sem_1010_hero, mime: 'image/jpeg', ext: 'jpg', width: 1920, height: 1080, version: 'b946ff7197' }, speaker: { data: img_sem_1010_speaker, mime: 'image/jpeg', ext: 'jpg', width: 480, height: 480, version: '4dc1073255' } },
  },
};
