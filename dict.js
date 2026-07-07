/* =========================================================================
   KHMER SUGGESTION DICTIONARY  (pinyin-style candidates)
   Each entry: [khmerWord, gloss, extraKeys?]
   Romanization keys are AUTO-GENERATED from the Khmer spelling by a reverse
   transliterator that emits several spelling variants per character, plus
   optional epenthetic vowels (so "srolanh" finds ស្រឡាញ់). extraKeys patches
   common irregular spellings ("suosdei", "kampuchea", ...).
   Exposes:  window.KHDICT.suggest(q) -> [{kh, gloss, key}]
   ========================================================================= */
(function () {
  const KD_COENG = "្";

  // ---- reverse maps: Khmer char -> latin variants (most typed first) ----
  const REV_CONS = {
    "ក":["k"], "ខ":["kh"], "គ":["k","g"], "ឃ":["kh","gh"], "ង":["ng"],
    "ច":["ch","j"], "ឆ":["chh","ch"], "ជ":["ch","j"], "ឈ":["chh","jh"], "ញ":["nh","ny"],
    "ដ":["d"], "ឋ":["th"], "ឌ":["d"], "ឍ":["th"], "ណ":["n"],
    "ត":["t","d"], "ថ":["th"], "ទ":["t","d","dd"], "ធ":["th","dh"], "ន":["n"],
    "ប":["b","p"], "ផ":["ph"], "ព":["p","b"], "ភ":["ph","bh"], "ម":["m"],
    "យ":["y"], "រ":["r"], "ល":["l"], "វ":["v","w"], "ស":["s"],
    "ហ":["h"], "ឡ":["l"], "អ":["a","o","q",""],
  };
  const REV_OTHER = {
    // dependent vowels
    "ា":["a","ea","aa"], "ិ":["i","e"], "ី":["ey","i","ii"],
    "ឹ":["oe","eu","e"], "ឺ":["eu","euu","u"],
    "ុ":["u","o"], "ូ":["ou","u","o","uu"], "ួ":["uo","ua","u"],
    "ើ":["ae","er","eu","aeu"], "ឿ":["ue","uea","oea"], "ៀ":["ie","ea"],
    "េ":["e","ei"], "ែ":["ae","e","ea"], "ៃ":["ai","ey","ei"],
    "ោ":["o","ao","ou","oa"], "ៅ":["ov","au","ow","av"],
    "ុំ":["om","um"], "ំ":["am","om","um"], "ាំ":["am","oam","eam"],
    "ះ":["ah","a","h"], "ុះ":["oh","uh"], "ោះ":["oh","aoh","uoh"],
    "េះ":["eh"], "ិះ":["ih","eh"],
    // signs (mostly silent in typing)
    "់":["","'"], "៉":[""], "៊":[""], "័":["","a","oa"],
    "៌":[""], "៍":[""], "៎":[""], "៏":["","a"], "ៈ":["","ak"],
    // independent vowels
    "ឥ":["e","i","ei"], "ឦ":["ei","i"], "ឧ":["u","o"], "ឩ":["ou"],
    "ឪ":["ov","au"], "ឫ":["re","reu"], "ឬ":["reu","rue"],
    "ឭ":["le","leu"], "ឮ":["leu","lue"], "ឯ":["ae","e"], "ឰ":["ai"],
    "ឱ":["ao","o","or"], "ឳ":["au","ov"],
  };
  const EPENTHETIC = ["","o","a"];   // inherent vowel users often type: chng→chang/chong
  const MAX_KEYS = 120;

  function romVariants(word) {
    const chars = [...word];
    const steps = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === KD_COENG) continue;               // cluster: letters just adjacent
      steps.push(REV_CONS[c] || REV_OTHER[c] || [""]);
      if (REV_CONS[c]) {
        // optional inherent vowel when the NEXT visible char is another consonant
        let j = i + 1;
        while (j < chars.length && (chars[j] === "៉" || chars[j] === "៊")) j++;
        const nx = chars[j];
        if (nx && nx !== KD_COENG && REV_CONS[nx]) steps.push(EPENTHETIC);
      }
    }
    let keys = [""];
    for (const opts of steps) {
      const next = [];
      for (const k of keys) {
        for (const o of opts) {
          next.push(k + o);
          if (next.length >= MAX_KEYS) break;
        }
        if (next.length >= MAX_KEYS) break;
      }
      keys = next;
    }
    return [...new Set(keys.filter(k => k.length > 0))];
  }

  /* ---- dictionary: frequency-ordered common words --------------------- */
  const DICT = [
    // greetings & politeness
    ["សួស្តី","hello","suosdei soursdey susdey suasdei"],
    ["ជំរាបសួរ","hello (formal)","chomreabsuor jomreabsour chumreapsour"],
    ["ជំរាបលា","goodbye (formal)","chomreablea jumreaplea"],
    ["អរគុណ","thank you","orkun arkun awkun akun"],
    ["សូម","please","som saum soum"],
    ["សូមទោស","sorry / excuse me","somtos saumtoh somtoh"],
    ["បាទ","yes (male)","baat bat"],
    ["ចាស","yes (female)","chas jas jaa"],
    ["ទេ","no","te tee"],
    ["មិនអីទេ","it's okay","minaite menaite"],
    ["សុខសប្បាយ","fine / well","soksabay sokhsabay"],
    ["ស្វាគមន៍","welcome","svakum swakom svakumn"],
    // pronouns & people
    ["ខ្ញុំ","I, me","khnhom knhom knyom kinhom"],
    ["អ្នក","you","neak nak anak"],
    ["លោក","you / Mr.","lok louk"],
    ["លោកស្រី","Mrs. / madam","loksrey louksrei"],
    ["គាត់","he / she","koat goat kat"],
    ["នាង","she","neang niang"],
    ["គេ","they / one","ke ge kee"],
    ["យើង","we","yeung yerng yoeng"],
    ["វា","it","vea wea via"],
    ["ពួកគេ","they","puokke pourkke puok"],
    ["គ្រួសារ","family","kruosa krousar kruosar"],
    ["ម្តាយ","mother","mday mtay maday"],
    ["ឪពុក","father","ovpuk aupuk"],
    ["ម៉ាក់","mom","mak"],
    ["ប៉ា","dad","pa paa"],
    ["បង","older sibling / dear","bang bong"],
    ["ប្អូន","younger sibling","poun baun b'oun paoun"],
    ["កូន","child (offspring)","kon kaun koun"],
    ["ប្រពន្ធ","wife","propun prapun brapun"],
    ["ប្តី","husband","pdey bdey"],
    ["បុរស","man","boros baorash"],
    ["ស្ត្រី","woman","strey satrey strei"],
    ["ក្មេង","child, kid","kmeng khmeng"],
    ["មិត្ត","friend","mit mitt"],
    ["មិត្តភក្តិ","friend (close)","mitpheak mittapheak"],
    // core verbs
    ["ទៅ","go","tov tow teuv tiv"],
    ["មក","come","mok mork"],
    ["ធ្វើ","do, make","thveu tveu thver twer"],
    ["មាន","have, there is","mean mien"],
    ["គ្មាន","not have","kmean khmean"],
    ["ចង់","want","chang chong jong"],
    ["ត្រូវ","correct / must","trov trouv trow"],
    ["អាច","can","ach aach"],
    ["ដឹង","know (fact)","deng doeng dung"],
    ["ស្គាល់","know (person)","skoal skal sgal"],
    ["ឃើញ","see","kheunh khernh keunh khoenh"],
    ["មើល","look, watch","meul merl moel"],
    ["ស្តាប់","listen","sdab stab sdap"],
    ["និយាយ","speak","niyeay niyiey"],
    ["ប្រាប់","tell","prab brab prap"],
    ["សួរ","ask","suor sour sua"],
    ["ឆ្លើយ","answer","chhlaey chhleuy chlaey"],
    ["ញ៉ាំ","eat","nham nhoam nyam gnam"],
    ["ហូប","eat (colloq.)","hob houb hop"],
    ["ផឹក","drink","phek pheuk"],
    ["ដេក","sleep","dek dec"],
    ["ក្រោក","get up","kraok krok"],
    ["ដើរ","walk","daeu deur der dae"],
    ["រត់","run","rot rut"],
    ["អង្គុយ","sit","angkuy ongkuy"],
    ["ឈរ","stand","chhor jhor"],
    ["រៀន","learn, study","rien rean"],
    ["បង្រៀន","teach","bangrien bongrean"],
    ["ធ្វើការ","work (v.)","thveuka tveuka thveukar"],
    ["លេង","play","leng leeng"],
    ["ស្រឡាញ់","love","srolanh sralanh"],
    ["ចូលចិត្ត","like","cholchet choulchit cholchit"],
    ["គិត","think","kit kut kid"],
    ["យល់","understand","yol yul"],
    ["ភ្លេច","forget","phlech plech"],
    ["ចាំ","remember / wait","cham"],
    ["ជួយ","help","chuoy juoy chuy"],
    ["ទិញ","buy","tinh dinh tign"],
    ["លក់","sell","lok luk"],
    ["ឱ្យ","give / let","aoy oy ory"],
    ["យក","take","yok yuk"],
    ["រក","look for","rok"],
    ["បាន","get / can / [past]","ban baan"],
    ["នៅ","at / stay","nov nou neuv"],
    ["រស់នៅ","live","rosnov ruosnov"],
    ["ត្រឡប់","return","trolab tralop trolop"],
    ["ចាប់ផ្តើម","start","chabphdaeum chapdaem chabpdaem"],
    ["បញ្ចប់","finish","banhchob bonhchop banhchab"],
    ["បើក","open / turn on","baek berk beuk"],
    ["បិទ","close / turn off","bet bit bed"],
    ["ចូល","enter","chol choul"],
    ["ចេញ","exit, leave","chenh cheng"],
    ["ឡើង","go up","laeng leung laerng"],
    ["ចុះ","go down","choh chuh"],
    ["អាន","read","an aan"],
    ["សរសេរ","write","sorse sarse sorser"],
    ["ហៅ","call","hav haw hau"],
    ["រង់ចាំ","wait","rongcham rangcham"],
    ["ស្វែងរក","search","svaengrok swaengrok"],
    ["ប្រើ","use","praeu preu prer prae"],
    ["ត្រូវការ","need","trovka trouvkar trovkar"],
    ["សម្រាក","rest","samrak somrak"],
    ["ជួប","meet","chuob choup juob"],
    ["ងូតទឹក","shower","ngoutteuk ngutteuk"],
    ["បើកបរ","drive","baekbor berkbor"],
    ["ហែលទឹក","swim","haelteuk helteuk"],
    ["ច្រៀង","sing","chrieng jrieng"],
    ["រាំ","dance","roam ram"],
    ["សើច","laugh","saeuch serch seuch"],
    ["យំ","cry","yum yom"],
    ["ញញឹម","smile","nhonhoem nhonhum nhonhem"],
    ["ព្យាយាម","try","pyayeam pyayam"],
    ["ជឿ","believe","cheua jeua chua"],
    ["ថត","photograph","that thot"],
    ["ការពារ","protect","kapea karpear kapear"],
    // feelings & states
    ["ខឹង","angry","kheng khoeng khung"],
    ["ខ្លាច","afraid","khlach klach"],
    ["សប្បាយ","happy, fun","sabay sabbay"],
    ["ហត់","tired","hot hat"],
    ["ឃ្លាន","hungry","khlean klean"],
    ["ស្រេក","thirsty","srek"],
    ["ឈឺ","sick, hurt","chheu chhoe chue"],
    ["រវល់","busy","rovol raval"],
    ["ទំនេរ","free, vacant","tumne tomner tumner"],
    // question words
    ["អ្វី","what","avey avei vey ey"],
    ["ណា","which / where","na"],
    ["ទីណា","where","tina tinaa"],
    ["ពេលណា","when","pelna"],
    ["ហេតុអ្វី","why","haetavey hetavey hetoavey"],
    ["ម៉េច","how / what's wrong","mech mich"],
    ["យ៉ាងម៉េច","how","yangmech"],
    ["ប៉ុន្មាន","how much / many","ponman punman"],
    ["នរណា","who","norna nornea"],
    ["អ្នកណា","who","neakna nakna"],
    // function words
    ["និង","and","ning noeng nueng"],
    ["ឬ","or","reu rue ry"],
    ["ប៉ុន្តែ","but","pontae puntae bontae"],
    ["តែ","only / but / tea","tae"],
    ["ព្រោះ","because","pruoh proh"],
    ["ពីព្រោះ","because","pipruoh piproh"],
    ["ដូច្នេះ","so, therefore","dochneh douchneh"],
    ["បើ","if","baeu ber beu"],
    ["ប្រសិនបើ","if","prasenbaeu prasenber"],
    ["ពេល","time / when","pel"],
    ["មុន","before","mun"],
    ["ក្រោយ","after","kraoy kroy"],
    ["ជាមួយ","with","cheamuoy jeamuy chiamuoy"],
    ["សម្រាប់","for","samrab somrap"],
    ["ពី","from / about","pi pii"],
    ["ដល់","until / to / arrive","dol dal"],
    ["ក្នុង","in","knong knung"],
    ["លើ","on","leu ler leur"],
    ["ក្រោម","under","kraom krom"],
    ["ក្រៅ","outside","krav krau krao"],
    ["នេះ","this","nih neh nis"],
    ["នោះ","that","nuh noh nus"],
    ["ទាំងអស់","all","teangos tangoh teangoh"],
    ["ខ្លះ","some","khlah klah"],
    ["ផង","also, too","phang phong"],
    ["ដែរ","also, too","dae der dear"],
    ["ណាស់","very","nas nah"],
    ["ពេក","too (much)","pek"],
    ["ហើយ","already / and then","haey heuy hery hoey"],
    ["នឹង","will","neng noeng nung"],
    ["កំពុង","(in the middle of)","kampung kompong kompung"],
    ["មិន","not","min men"],
    ["អត់","no, not (colloq.)","ot at od aut"],
    ["កុំ","don't","kom kum"],
    ["ម្តងទៀត","again","mdongtiet mtongteat mdangteat"],
    ["ឥឡូវ","now","ilov elov eylov ilow"],
    ["រួច","done, already","ruoch rouch"],
    ["គ្រប់","every / enough","krob krup"],
    ["ខ្លាំង","strong / very","khlang klang"],
    ["ដូចគ្នា","same","dochknea douchknea"],
    ["ខុសគ្នា","different","khosknea khohknea"],
    ["ជិត","near","chit jit"],
    ["ឆ្ងាយ","far","chhngay chngay"],
    ["ប្រហែល","maybe, about","prohael prahel prohel"],
    ["ប្រាកដ","sure, certain","prakot prakad brakad"],
    ["ភ្លាម","immediately","phleam pleam"],
    ["យូរ","a long time","you yu yur"],
    ["បន្តិច","a little","bantech bontich bandich"],
    ["ពិត","true","pit"],
    ["ហេតុ","reason, event","het hetu haet"],
    // adjectives
    ["ល្អ","good","laor la l'a"],
    ["អាក្រក់","bad","akrak akrok"],
    ["ធំ","big","thom thum"],
    ["តូច","small","toch touch tauch"],
    ["វែង","long","veng weng vaeng"],
    ["ខ្លី","short","khley khlei kley"],
    ["ខ្ពស់","tall, high","khpos kpos khpuos"],
    ["ទាប","low, short","teab tab"],
    ["ថ្មី","new","thmey tmey thmei"],
    ["ចាស់","old","chas chah jas"],
    ["លឿន","fast","luon leuon luen loeun"],
    ["យឺត","slow, late","yeut yut yuet"],
    ["ស្អាត","beautiful, clean","s'at saat sat"],
    ["កខ្វក់","dirty","kakhvak kokhvok"],
    ["ឆ្ងាញ់","delicious","chhnganh chnganh chganh"],
    ["ផ្អែម","sweet","ph'aem phaem paem"],
    ["ជូរ","sour","chou jou chu"],
    ["ហឹរ","spicy","hel heur her"],
    ["ប្រៃ","salty","prai prey brai"],
    ["ថ្លៃ","expensive, dear","thlai tlai thley"],
    ["ថោក","cheap","thaok thok"],
    ["ច្រើន","many, much","chraeun chreun craen chraen"],
    ["តិច","few, little","tech tich"],
    ["ងាយស្រួល","easy","ngaysruol ngeaysrual ngaysrual"],
    ["ពិបាក","difficult","pibak"],
    ["សំខាន់","important","samkhan somkhan"],
    ["ត្រឹមត្រូវ","correct","troemtrov trumtrov"],
    ["ខុស","wrong","khos khoh"],
    ["ក្តៅ","hot","kdav kdaw ktau kdao"],
    ["ត្រជាក់","cold","trocheak trajak trorcheak"],
    ["អស្ចារ្យ","amazing","oschar aschar aschary"],
    ["ស្ងាត់","quiet","sngat"],
    ["ច្បាស់","clear, sure","chbas chbah"],
    ["សំណាង","luck","samnang somnang"],
    // food & drink
    ["ទឹក","water","teuk tuk"],
    ["បាយ","rice, meal","bay baay"],
    ["អាហារ","food","aha ahar aahaar"],
    ["នំ","cake, snack","num nom"],
    ["នំប៉័ង","bread","numpang nompang"],
    ["ត្រី","fish","trey trei"],
    ["សាច់","meat","sach"],
    ["សាច់ជ្រូក","pork","sachchrouk sachjruk"],
    ["សាច់គោ","beef","sachko sachkou"],
    ["មាន់","chicken","moan man"],
    ["បន្លែ","vegetable","banlae bonle banle"],
    ["ផ្លែឈើ","fruit","phlaechheu plaecher"],
    ["កាហ្វេ","coffee","kafe kahve cafe kaafe"],
    ["ទឹកដោះគោ","milk","teukdohko tukdohkou"],
    ["ស្ករ","sugar","skor ska skar"],
    ["អំបិល","salt","ambel ombel"],
    // places & things
    ["ផ្ទះ","house, home","phteah pteah ptes"],
    ["បន្ទប់","room","bantub bontup bantob"],
    ["សាលារៀន","school","salarien salarean"],
    ["សាលា","school / hall","sala"],
    ["មន្ទីរពេទ្យ","hospital","muntipet montipet"],
    ["ពេទ្យ","medical / doctor","pet paet"],
    ["គ្រូពេទ្យ","doctor","krupet kroupet"],
    ["គ្រូ","teacher","kru krou"],
    ["សិស្ស","student","ses sess seh"],
    ["ផ្សារ","market","phsa psa phsar"],
    ["ហាង","shop","hang haang"],
    ["ភោជនីយដ្ឋាន","restaurant","phochniyathan phochaniyathan"],
    ["ធនាគារ","bank","thneakea thonakea thoneakea"],
    ["ការិយាល័យ","office","kariyalay karyalay"],
    ["ផ្លូវ","road, way","phlov plov phlouv"],
    ["ឡាន","car","lan laan"],
    ["ម៉ូតូ","motorbike","moto motou"],
    ["កង់","bicycle / wheel","kang kong"],
    ["រថភ្លើង","train","rothphleung rotpleung"],
    ["យន្តហោះ","airplane","yunhoh yontahoh yunhawh"],
    ["កប៉ាល់","ship","kapal"],
    ["ទូក","boat","touk tuk"],
    ["ទូរស័ព្ទ","phone","tourasap torasap turasap"],
    ["កុំព្យូទ័រ","computer","kompyuter computer kompyouto"],
    ["អ៊ីនធឺណិត","internet","internet intheunet"],
    ["សៀវភៅ","book","sievphov seavphov sievphow"],
    ["ប៊ិច","pen","bich bic"],
    ["ខ្មៅដៃ","pencil","khmavdai kmawdai"],
    ["តុ","table","tok tu"],
    ["កៅអី","chair","kaoey kawey kavei"],
    ["គ្រែ","bed","krae kre"],
    ["ទ្វារ","door","tvea tvear twear"],
    ["បង្អួច","window","bangouch bang'uoch"],
    ["លុយ","money","luy loy"],
    ["ប្រាក់","money / silver","prak brak"],
    ["ការងារ","work, job","kangear kangea karngear"],
    ["ភ្លើង","fire / light","phleung pleung"],
    ["អគ្គិសនី","electricity","akkisani aksesani"],
    // time
    ["ពេលវេលា","time","pelvelea"],
    ["ថ្ងៃ","day / sun","thngai tngai"],
    ["យប់","night","yub yup yob"],
    ["ព្រឹក","morning","prek proek pruk"],
    ["ល្ងាច","evening","lngeach lngiech"],
    ["រសៀល","afternoon","rosiel roseal"],
    ["ថ្ងៃនេះ","today","thngainih tngaineh thngaineh"],
    ["ម្សិលមិញ","yesterday","mselmenh maselminh mselminh"],
    ["ស្អែក","tomorrow","saek s'aek"],
    ["ថ្ងៃស្អែក","tomorrow","thngaisaek tngaisaek"],
    ["សប្តាហ៍","week","sapda sabda saptah"],
    ["ចុងសប្តាហ៍","weekend","chongsapda"],
    ["ខែ","month / moon","khae khe"],
    ["ឆ្នាំ","year","chhnam chnam"],
    ["ម៉ោង","hour, o'clock","maong mong"],
    ["នាទី","minute","neati niati"],
    ["ថ្ងៃច័ន្ទ","Monday","thngaichan"],
    ["ច័ន្ទ","Monday / moon","chan"],
    ["អង្គារ","Tuesday","angkear ongkear angkea"],
    ["ពុធ","Wednesday","put puth put"],
    ["ព្រហស្បតិ៍","Thursday","prohos prohoah prohosbate"],
    ["សុក្រ","Friday","sokr sok sokra"],
    ["សៅរ៍","Saturday","sav saov sao"],
    ["អាទិត្យ","Sunday / week","atit aatity"],
    // language & country
    ["ភាសា","language","pheasa phiesa"],
    ["ភាសាខ្មែរ","Khmer language","pheasakhmae phiesakhmer"],
    ["ខ្មែរ","Khmer","khmae khmer kmae"],
    ["កម្ពុជា","Cambodia","kampuchea kampujea kambuja kampucha"],
    ["ភ្នំពេញ","Phnom Penh","phnompenh pnompenh"],
    ["សៀមរាប","Siem Reap","siemreab semreap siemreap"],
    ["អង្គរវត្ត","Angkor Wat","angkorwat angkorvoat"],
    ["អង្គរ","Angkor","angkor angko ongko"],
    ["ស្រុក","district / homeland","srok sruk"],
    ["ខេត្ត","province","khet khaet"],
    ["ក្រុង","city","krong krung"],
    ["ទីក្រុង","city","tikrong tikrung"],
    ["ភូមិ","village","phum poum"],
    ["ប្រទេស","country","protes prates brates"],
    ["ពិភពលោក","world","piphoplok pipoplok"],
    ["ជាតិ","nation","cheat jeat chiet"],
    ["រាជធានី","capital","reachtheani riechthieni"],
    ["ប្រជាជន","people, citizens","procheachun prajajon"],
    // nature & animals
    ["មេឃ","sky","mek megh"],
    ["ភ្លៀង","rain","phlieng plieng"],
    ["ខ្យល់","wind","khyol kyal khyal"],
    ["ភ្នំ","mountain","phnom pnum pnom"],
    ["ទន្លេ","river","tonle tunle"],
    ["សមុទ្រ","sea","samut samot samutr"],
    ["កោះ","island","kaoh koh"],
    ["ព្រៃ","forest","prey prei"],
    ["ដើមឈើ","tree","daeumchheu dermcher daemcher"],
    ["ផ្កា","flower","phka pka"],
    ["ឆ្កែ","dog","chhkae chkae chke"],
    ["ឆ្មា","cat","chhma chma"],
    ["ជ្រូក","pig","chrouk jruk"],
    ["គោ","cow","ko kou"],
    ["សេះ","horse","seh"],
    ["ដំរី","elephant","damrey domrei"],
    ["ខ្លា","tiger","khla kla"],
    ["ស្វា","monkey","sva swa"],
    ["សត្វ","animal","sat satv"],
    // body
    ["ក្បាល","head","kbal"],
    ["មុខ","face / front","muk mok"],
    ["ភ្នែក","eye","phnaek pnek"],
    ["ច្រមុះ","nose","chramuh chromoh"],
    ["មាត់","mouth","moat mat"],
    ["ត្រចៀក","ear","trachiek trocheak"],
    ["សក់","hair","sak sok"],
    ["ដៃ","hand, arm","dai dei day"],
    ["ជើង","leg, foot","cheung jerng cherng"],
    ["បេះដូង","heart","behdoung behdong"],
    ["ចិត្ត","heart, mind","chet chit"],
    ["ឈាម","blood","chheam cheam"],
    ["រាងកាយ","body","reangkay rangkay"],
    // colors
    ["ពណ៌","color","po poa pon"],
    ["ក្រហម","red","krahom krohom"],
    ["ខៀវ","blue","khiev khiew"],
    ["បៃតង","green","baitang beitong baitong"],
    ["លឿង","yellow","luong leung lueang"],
    ["ស","white","sa sor"],
    ["ខ្មៅ","black","khmav khmaw kmao"],
    // media & study
    ["ឈ្មោះ","name","chhmuoh chmoh chhmoh"],
    ["រូបភាព","picture","roubpheap rupphea roubphea"],
    ["រូបថត","photo","roubthot rupthat"],
    ["ចម្រៀង","song","chamrieng chomreang"],
    ["ភាពយន្ត","movie","pheapyun phapyon"],
    ["កីឡា","sport","keyla kila"],
    ["បាល់ទាត់","football","baltoat baltat"],
    ["អាកាសធាតុ","weather","akasathat akastheat"],
    ["ព័ត៌មាន","news, info","poatamean patmien poatmean"],
    ["សំណួរ","question","samnuo somnuor samnour"],
    ["ចម្លើយ","answer (n.)","chamlaey chomleuy"],
    ["រឿង","story / matter","rueng reuong roeung"],
    ["បញ្ហា","problem","banha bonha panha"],
    ["ជំនួយ","help (n.)","chumnuoy jomnuy"],
    ["សំបុត្រ","letter / ticket","sambot sombot"],
    ["ពាក្យ","word","peak piek pheak"],
    ["អត្ថបទ","article, text","atthabat attabot"],
    ["ការសិក្សា","education, study","kaseksa karsiksa"],
    ["វិទ្យាល័យ","high school","vityalay vithyealay"],
    ["សាកលវិទ្យាល័យ","university","sakalvityalay"],
    ["កម្មវិធី","program, app","kammavithi kamavithy kammvithi"],
    ["សារ","message","sar saa"],
    ["អ៊ីមែល","email","email imel"],
    ["កិច្ចការ","task","kechka kichkar"],
    ["ប្រជុំ","meeting","prochum prajum"],
    ["ទីតាំង","location","titang titaing"],
    ["អាសយដ្ឋាន","address","asayathan"],
    ["ជោគជ័យ","success","chokchey joukjey"],
    ["សន្តិភាព","peace","santipheap sontepheap"],
    ["សេរីភាព","freedom","sereipheap"],
    // police & law (CSI work)
    ["ប៉ូលិស","police","polis police"],
    ["នគរបាល","police (formal)","nokorbal"],
    ["របាយការណ៍","report","robaykar rabaykarn robaykarn"],
    ["ភស្តុតាង","evidence","phostotang phostutang"],
    ["កន្លែង","place","kanlaeng konleng"],
    ["កន្លែងកើតហេតុ","crime scene","kanlaengkaethetu kanlaengkoethetu"],
    ["បទល្មើស","offense, crime","botlmoeh batlmeus botlmers"],
    ["តុលាការ","court","tolaka tulakar tolakar"],
    ["ច្បាប់","law","chbab chbap"],
    ["សាក្សី","witness","saksey saksei"],
    ["ជនសង្ស័យ","suspect","chunsangsay junsongsay"],
    ["ស៊ើបអង្កេត","investigate","seubangket serbangket"],
    ["គ្រោះថ្នាក់","accident, danger","kruohthnak krohtnak"],
    ["ចោរ","thief","chao chor jao"],
    ["សុវត្ថិភាព","safety","sovathipheap suvatthipheap"],
    ["រដ្ឋាភិបាល","government","rathaphibal rothaphibal"],
    ["មន្ត្រី","official, officer","muntrey montrei"],
    ["អាវុធ","weapon","avuth awut"],
    ["ថ្នាំ","medicine / drug","thnam tnam"],
    ["រថយន្ត","vehicle","rothyun rotyon"],
    ["ចរាចរណ៍","traffic","charachar chorachor"],
    ["ល្បឿន","speed","lbuon lbeun lbuen"],
    // numbers
    ["មួយ","one","muoy muy mouy"],
    ["ពីរ","two","pir pi py"],
    ["បី","three","bey bei bii"],
    ["បួន","four","buon boun"],
    ["ប្រាំ","five","pram bram"],
    ["ប្រាំមួយ","six","prammuoy prammuy"],
    ["ប្រាំពីរ","seven","prampi prampir"],
    ["ប្រាំបី","eight","prambey prambei"],
    ["ប្រាំបួន","nine","prambuon pramboun"],
    ["ដប់","ten","dob dop"],
    ["ម្ភៃ","twenty","mphey mpei mapei"],
    ["សាមសិប","thirty","samseb samsep"],
    ["សែសិប","forty","saeseb seseb"],
    ["ហាសិប","fifty","haseb hasep"],
    ["ហុកសិប","sixty","hokseb hoksep"],
    ["ចិតសិប","seventy","chetseb chetsep"],
    ["ប៉ែតសិប","eighty","paetseb paetsep"],
    ["កៅសិប","ninety","kausep kaoseb kavseb"],
    ["រយ","hundred","roy ray"],
    ["ពាន់","thousand","poan pean pan"],
    ["ម៉ឺន","ten thousand","meun muen"],
    ["លាន","million","lean lian"],
    ["សូន្យ","zero","son soun souny"],
    ["លេខ","number","lek lekh"],
    ["រៀល","riel (money)","riel real"],
    ["ដុល្លារ","dollar","dolla dollar"],
    // everyday / social-media colloquial
    ["អូន","dear, younger loved one","oun own on"],
    ["សុំ","ask for / gimme (colloq.)","som sum"],
    ["ស្អី","what (colloq.)","s'ey sey saey"],
    ["អីចឹង","like that, so (colloq.)","eycheung eychoeng icheung eijeung"],
    ["អញ្ចឹង","so, in that case","anhcheung anchoeng anhjeung"],
    ["ចឹង","so, then (colloq.)","cheung choeng jeung"],
    ["ម៉ង","at once, really (colloq.)","mong mang"],
    ["អត់អីទេ","no problem (colloq.)","oteyte otaite ot'eyte"],
    ["ម៉េចដែរ","how is it? (colloq.)","mechder mechdae michder"],
    ["អត់ដឹង","don't know (colloq.)","otdeng atdoeng otdoeng"],
    ["ហ្នឹង","that, this (colloq.)","neng nung hneng"],
    ["សុំទោស","sorry (colloq.)","somtos sumtoh somtoh"],
    ["អរគុណច្រើន","thanks a lot","orkunchraeun akunchren orkunchren"],
  ];

  /* ---- curated index: key -> word indices ------------------------------ */
  // vowel skeleton: collapse vowel runs so sousdey/suosdei meet at "s8sd8"
  function vskel(s) { return s.replace(/[aeiouy]+/g, "8"); }

  const INDEX = [];               // {k, sk, wi}
  DICT.forEach((entry, wi) => {
    const keys = new Set(romVariants(entry[0]));
    if (entry[2]) entry[2].split(/\s+/).forEach(k => k && keys.add(k.toLowerCase()));
    keys.forEach(k => INDEX.push({ k, sk: vskel(k), wi }));
  });

  /* ---- big lexicon (words.txt): 62k words from the Google Khmer
     pronunciation lexicon, ranked by Khmer-Wikipedia frequency. Each line is
     "khmer\tSKEL" where SKEL is a coarse sound-class skeleton. ------------- */
  let BIG_KH = [], BIG_SK = [];
  fetch("words.txt")
    .then(r => (r.ok ? r.text() : ""))
    .then(t => {
      for (const ln of t.split("\n")) {
        const i = ln.indexOf("\t");
        if (i > 0) { BIG_KH.push(ln.slice(0, i)); BIG_SK.push(ln.slice(i + 1)); }
      }
    })
    .catch(() => {});               // offline/file:// -> curated dict only

  // Query -> the same sound-class skeleton the build pipeline emits.
  // Classes: K C T P S H M N J G L R W Y, V = any vowel run.
  const DIGRAPH = { chh:"C", ch:"C", kh:"K", gh:"K", th:"T", dh:"T", dd:"T",
                    ph:"P", bh:"P", ng:"G", nh:"J", ny:"J", gn:"J" };
  const SINGLE  = { k:"K", g:"K", c:"C", j:"C", t:"T", d:"T", b:"P", p:"P",
                    f:"P", s:"S", h:"H", m:"M", n:"N", l:"L", x:"S", z:"S" };
  const isVow = ch => "aeiou".includes(ch);
  function qskel(q) {
    q = q.toLowerCase().replace(/[^a-z]/g, "");
    const out = [];
    const push = c => { if (c && out[out.length - 1] !== c) out.push(c); };
    let i = 0;
    while (i < q.length) {
      const tri = q.slice(i, i + 3), di = q.slice(i, i + 2), ch = q[i];
      if (DIGRAPH[tri]) { push(DIGRAPH[tri]); i += 3; continue; }
      if (DIGRAPH[di])  { push(DIGRAPH[di]);  i += 2; continue; }
      if (isVow(ch)) { push("V"); i++; continue; }
      if (ch === "w" || ch === "v" || ch === "y") {
        // onset -> consonant; coda -> part of the vowel (tov, chhkay)
        if (isVow(q[i + 1])) push(ch === "y" ? "Y" : "W");
        else push("V");
        i++; continue;
      }
      if (ch === "r") {           // Khmer r is only pronounced before a vowel
        if (isVow(q[i + 1])) push("R");
        i++; continue;
      }
      if (ch === "s" && isVow(q[i - 1]) && !isVow(q[i + 1])) {
        push("H"); i++; continue;   // coda s sounds like h: monus = monuh
      }
      if (ch === "q") { i++; continue; }                                  // glottal, often untyped
      push(SINGLE[ch] || ""); i++;
    }
    return out.join("");
  }

  /* ---- next-word prediction (corpus bigrams + your own phrases) -------- */
  const NEXT = new Map();
  fetch("bigrams.txt")
    .then(r => (r.ok ? r.text() : ""))
    .then(t => {
      for (const ln of t.split("\n")) {
        const i = ln.indexOf("\t");
        if (i > 0) NEXT.set(ln.slice(0, i), ln.slice(i + 1).split(" "));
      }
    })
    .catch(() => {});

  let NEXTP = {};                                  // your phrases: prev -> {next: count}
  try { NEXTP = JSON.parse(localStorage.getItem("khkb_next") || "{}"); } catch (e) {}
  function learnNext(prev, next) {
    if (!prev || !next) return;
    const m = NEXTP[prev] = NEXTP[prev] || {};
    m[next] = (m[next] || 0) + 1;
    try { localStorage.setItem("khkb_next", JSON.stringify(NEXTP)); } catch (e) {}
  }
  function predictNext(prev) {
    if (!prev) return [];
    const out = [], seen = new Set();
    const mine = NEXTP[prev];
    if (mine) {
      for (const [w] of Object.entries(mine).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
        out.push(w); seen.add(w);
      }
    }
    for (const w of NEXT.get(prev) || []) {
      if (!seen.has(w)) { out.push(w); seen.add(w); }
      if (out.length >= 6) break;
    }
    // fall back to YOUR most-used words first, then globally common ones
    for (const w of topUsed(6)) {
      if (out.length >= 6) break;
      if (w !== prev && !seen.has(w)) { out.push(w); seen.add(w); }
    }
    for (let i = 0; out.length < 6 && i < Math.min(BIG_KH.length, 12); i++) {
      const w = BIG_KH[i];
      if (w !== prev && !seen.has(w)) { out.push(w); seen.add(w); }
    }
    return out.slice(0, 6);
  }

  /* ---- whole-phrase typing (pinyin sentence mode) -----------------------
     "khnhomsrolanhkampuchea" -> segment by sound skeletons with a DP over
     split points, scored by word frequency + bigram/your-phrase bonuses. */
  let SK2WORD = null;
  function buildSK2() {
    SK2WORD = new Map();
    for (let i = 0; i < BIG_SK.length; i++) {
      if (!SK2WORD.has(BIG_SK[i])) SK2WORD.set(BIG_SK[i], { w: BIG_KH[i], r: i });
    }
  }
  const MAX_PHRASE = 60;          // cap DP length; longer inputs aren't one phrase
  function segmentPhrase(q) {
    if (!BIG_SK.length) return null;
    if (q.length > MAX_PHRASE) return null;
    if (!SK2WORD) buildSK2();
    const n = q.length;
    const dp = Array(n + 1).fill(null);
    dp[0] = { score: 0, prev: -1, word: null };
    for (let i = 0; i < n; i++) {
      if (!dp[i]) continue;
      for (let j = i + 2; j <= Math.min(n, i + 14); j++) {
        const sk = qskel(q.slice(i, j));
        if (sk.length < 2) continue;
        const hit = SK2WORD.get(sk);
        if (!hit) continue;
        let s = dp[i].score + Math.log(hit.r + 2) + 3;   // frequency + per-word cost
        if (dp[i].word) {
          const nx = NEXT.get(dp[i].word);
          if (nx && nx.includes(hit.w)) s -= 2;          // corpus phrase bonus
          const mine = NEXTP[dp[i].word];
          if (mine && mine[hit.w]) s -= 3;               // your own phrase bonus
        }
        if (!dp[j] || s < dp[j].score) dp[j] = { score: s, prev: i, word: hit.w };
      }
    }
    if (!dp[n]) return null;
    const segs = [];
    for (let k = n; k > 0; k = dp[k].prev) segs.unshift(dp[k].word);
    if (segs.length < 2) return null;
    return { kh: segs.join(""), segs };
  }

  /* ---- backup / restore of everything learned --------------------------- */
  function exportData() {
    return { usage: USAGE, personal: PERSONAL, next: NEXTP, v: 1 };
  }
  const isPlain = o => o && typeof o === "object" && !Array.isArray(o);
  const UNSAFE = k => k === "__proto__" || k === "constructor" || k === "prototype";
  const cnt = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 1e6) : 0; };
  const IMP_MAX_KEYS = 20000, IMP_MAX_LEN = 60;   // guard against bloat / oversized backups

  function importData(obj) {
    if (!isPlain(obj)) return false;
    if (isPlain(obj.usage)) {
      let i = 0;
      for (const w in obj.usage) {
        if (UNSAFE(w) || w.length > IMP_MAX_LEN || ++i > IMP_MAX_KEYS) continue;
        const c = cnt(obj.usage[w]); if (c) USAGE[w] = (USAGE[w] || 0) + c;
      }
    }
    if (isPlain(obj.personal)) {
      let i = 0;
      for (const k in obj.personal) {
        if (UNSAFE(k) || ++i > IMP_MAX_KEYS) continue;
        const v = obj.personal[k];
        if (typeof v === "string" && k.length <= IMP_MAX_LEN && v.length <= IMP_MAX_LEN) PERSONAL[k] = v;
      }
    }
    if (isPlain(obj.next)) {
      let i = 0;
      for (const p in obj.next) {
        if (UNSAFE(p) || p.length > IMP_MAX_LEN || ++i > IMP_MAX_KEYS || !isPlain(obj.next[p])) continue;
        const m = NEXTP[p] = NEXTP[p] || {};
        for (const nx in obj.next[p]) {
          if (UNSAFE(nx) || nx.length > IMP_MAX_LEN) continue;
          const c = cnt(obj.next[p][nx]); if (c) m[nx] = (m[nx] || 0) + c;
        }
      }
    }
    try {
      localStorage.setItem("khkb_usage",    JSON.stringify(USAGE));
      localStorage.setItem("khkb_personal", JSON.stringify(PERSONAL));
      localStorage.setItem("khkb_next",     JSON.stringify(NEXTP));
    } catch (e) {}
    return true;
  }

  /* ---- your frequent words (Apple keyboard-dictionary style) ----------- */
  function topUsed(n) {
    return Object.entries(USAGE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([w]) => w);
  }
  function stats() {
    return {
      top: Object.entries(USAGE).sort((a, b) => b[1] - a[1]).slice(0, 30),
      personal: Object.entries(PERSONAL),
      phrases: Object.keys(NEXTP).length,
    };
  }
  function resetLearning() {
    USAGE = {}; PERSONAL = {}; NEXTP = {};
    try {
      localStorage.removeItem("khkb_usage");
      localStorage.removeItem("khkb_personal");
      localStorage.removeItem("khkb_next");
    } catch (e) {}
  }

  /* ---- learning from real use (persisted locally) ---------------------- */
  let USAGE = {}, PERSONAL = {};
  try {
    USAGE    = JSON.parse(localStorage.getItem("khkb_usage")    || "{}");
    PERSONAL = JSON.parse(localStorage.getItem("khkb_personal") || "{}");
  } catch (e) {}
  function learn(kh, token, wasRaw) {
    USAGE[kh] = (USAGE[kh] || 0) + 1;
    if (wasRaw && token && token.replace(/[^a-z]/gi, "").length >= 3) {
      PERSONAL[token.toLowerCase()] = kh;     // user's own word + own spelling
    }
    try {
      localStorage.setItem("khkb_usage",    JSON.stringify(USAGE));
      localStorage.setItem("khkb_personal", JSON.stringify(PERSONAL));
    } catch (e) {}
  }

  /* ---- merged, tiered suggest ------------------------------------------
     tiers: -1 your own saved words · 0-3 curated (exact/prefix/vowel-skel)
            4-5 big lexicon (sound-skeleton exact/prefix)
     words you actually use float upward (usage boost). ------------------- */
  const MAX_TOKEN = 32;           // no real phonetic word-token is longer
  function suggest(q) {
    q = (q || "").toLowerCase().trim();
    if (!q) return [];
    if (q.length > MAX_TOKEN) q = q.slice(-MAX_TOKEN);   // guard: bound the work
    const cand = new Map();       // kh -> {tier, sub, gloss}
    const add = (kh, tier, sub, gloss) => {
      const c = cand.get(kh);
      if (!c) { cand.set(kh, { tier, sub, gloss: gloss || "" }); return; }
      if (tier < c.tier || (tier === c.tier && sub < c.sub)) { c.tier = tier; c.sub = sub; }
      if (!c.gloss && gloss) c.gloss = gloss;
    };

    for (const t in PERSONAL) {
      if (t === q) add(PERSONAL[t], -1, 0, "yours");
      else if (t.startsWith(q)) add(PERSONAL[t], -1, t.length - q.length, "yours");
    }

    const qs = vskel(q);
    const fuzzyOK = q.length >= 3;
    for (const { k, sk, wi } of INDEX) {
      let tier, sub = 0;
      if (k === q) tier = 0;
      else if (k.startsWith(q)) { tier = 1; sub = k.length - q.length; }
      else if (fuzzyOK && sk === qs) tier = 2;
      else if (fuzzyOK && sk.startsWith(qs)) { tier = 3; sub = sk.length - qs.length; }
      else continue;
      add(DICT[wi][0], tier, sub, DICT[wi][1]);
    }

    if (fuzzyOK && BIG_KH.length) {
      const qk = qskel(q);
      if (qk.length >= 2) {
        let hits = 0;
        for (let i = 0; i < BIG_SK.length && hits < 300; i++) {
          if (BIG_SK[i] === qk) { add(BIG_KH[i], 4, i); hits++; }
          else if (BIG_SK[i].startsWith(qk)) {
            add(BIG_KH[i], 5, (BIG_SK[i].length - qk.length) * 1e5 + i); hits++;
          }
        }
      }
    }

    let minTier = 99;
    for (const m of cand.values()) if (m.tier < minTier) minTier = m.tier;
    const list = [...cand.entries()]
      .map(([kh, m]) => {
        const u = USAGE[kh] || 0;
        const boost = u >= 4 ? 2 : u >= 1 ? 1 : 0;
        return { kh, gloss: m.gloss, _k: (m.tier - boost) * 1e12 + m.sub - u };
      })
      .sort((a, b) => a._k - b._k)
      .slice(0, 8)
      .map(({ kh, gloss }) => ({ kh, gloss }));

    // pinyin sentence mode: offer the segmented phrase for long inputs
    if (q.length >= 7) {
      const ph = segmentPhrase(q);
      if (ph && !list.some(x => x.kh === ph.kh)) {
        const at = minTier <= 1 ? 1 : 0;   // strong single-word match keeps #1
        list.splice(at, 0, { kh: ph.kh, gloss: "ឃ្លា · phrase", segs: ph.segs });
        if (list.length > 8) list.pop();
      }
    }
    return list;
  }

  window.KHDICT = { suggest, learn, predictNext, learnNext, topUsed, stats, resetLearning,
                    exportData, importData, segmentPhrase, DICT, romVariants, qskel,
                    bigCount: () => BIG_KH.length, nextCount: () => NEXT.size };
})();
