/* Vita Plena — the prayer library.
   Traditional texts, public domain. Each prayer has an id, a title, tags that let
   a practice name match it ("rosary" matches "Evening Rosary"), and either `body`
   (paragraphs of plain text) or `guided` (a stepper: the Rosary, the Chaplet, the
   Examen). Latin titles where the tradition uses them; English text throughout.

   Tradition speaks, science confirms: `why` is one line from the tradition,
   `does` one line from the evidence. Both are shown; the Church is the authority. */

export const SIGN_OF_CROSS="In the name of the Father, and of the Son, and of the Holy Spirit. Amen.";
export const OUR_FATHER="Our Father, who art in heaven, hallowed be Thy name; Thy kingdom come; Thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen.";
export const HAIL_MARY="Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.";
export const GLORY_BE="Glory be to the Father, and to the Son, and to the Holy Spirit; as it was in the beginning, is now, and ever shall be, world without end. Amen.";
export const FATIMA="O my Jesus, forgive us our sins, save us from the fires of hell, and lead all souls to Heaven, especially those most in need of Thy mercy.";
export const APOSTLES_CREED="I believe in God, the Father almighty, Creator of heaven and earth; and in Jesus Christ, His only Son, our Lord; who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried. He descended into hell; the third day He rose again from the dead; He ascended into heaven, and is seated at the right hand of God the Father almighty; from thence He shall come to judge the living and the dead. I believe in the Holy Spirit, the holy Catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.";
export const HAIL_HOLY_QUEEN="Hail, holy Queen, Mother of mercy, our life, our sweetness, and our hope. To thee do we cry, poor banished children of Eve; to thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious Advocate, thine eyes of mercy toward us, and after this our exile, show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary.\n\nV. Pray for us, O holy Mother of God.\nR. That we may be made worthy of the promises of Christ.";
export const ROSARY_CLOSING="Let us pray. O God, whose only-begotten Son, by His life, death, and resurrection, has purchased for us the rewards of eternal life; grant, we beseech Thee, that by meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen.";
export const ACT_OF_CONTRITION="O my God, I am heartily sorry for having offended Thee, and I detest all my sins because I dread the loss of Heaven and the pains of hell; but most of all because they offend Thee, my God, who art all good and deserving of all my love. I firmly resolve, with the help of Thy grace, to confess my sins, to do penance, and to amend my life. Amen.";

export const PRAYERS=[
  {id:"offering",title:"The Morning Offering",latin:"",tags:["morning offering","offering","morning prayer"],time:"morning",
   why:"The first act of the day given to God orders every act that follows.",
   does:"A stated intention at waking sets the day's default before anything else can.",
   body:["O Jesus, through the Immaculate Heart of Mary, I offer Thee my prayers, works, joys, and sufferings of this day, for all the intentions of Thy Sacred Heart, in union with the Holy Sacrifice of the Mass throughout the world, in reparation for my sins, for the intentions of all my relatives and friends, and in particular for the intentions of the Holy Father. Amen."]},

  {id:"angelus",title:"The Angelus",tags:["angelus"],time:"noon",
   why:"Three times a day the Church stops to remember that God became man.",
   does:"A brief, scheduled interruption resets attention; ninety seconds away returns focus.",
   body:["V. The Angel of the Lord declared unto Mary,\nR. And she conceived of the Holy Spirit.",
         HAIL_MARY,
         "V. Behold the handmaid of the Lord,\nR. Be it done unto me according to thy word.",
         HAIL_MARY,
         "V. And the Word was made flesh,\nR. And dwelt among us.",
         HAIL_MARY,
         "V. Pray for us, O holy Mother of God,\nR. That we may be made worthy of the promises of Christ.",
         "Let us pray. Pour forth, we beseech Thee, O Lord, Thy grace into our hearts, that we, to whom the Incarnation of Christ Thy Son was made known by the message of an angel, may by His Passion and Cross be brought to the glory of His Resurrection. Through the same Christ our Lord. Amen."]},

  {id:"reginacaeli",title:"Regina Caeli",tags:[],time:"noon",note:"In Eastertide the Regina Caeli replaces the Angelus.",
   why:"The Easter Church greets her Queen with alleluia; sorrow is put away for fifty days.",
   does:"Changing the words with the season keeps a daily prayer from going automatic.",
   body:["V. Queen of Heaven, rejoice, alleluia.\nR. For He whom thou didst merit to bear, alleluia.",
         "V. Hath risen as He said, alleluia.\nR. Pray for us to God, alleluia.",
         "V. Rejoice and be glad, O Virgin Mary, alleluia.\nR. For the Lord hath truly risen, alleluia.",
         "Let us pray. O God, who through the Resurrection of Thy Son, our Lord Jesus Christ, didst vouchsafe to give joy to the world: grant, we beseech Thee, that through His Mother, the Virgin Mary, we may obtain the joys of everlasting life. Through the same Christ our Lord. Amen."]},

  {id:"rosary",title:"The Holy Rosary",tags:["rosary","holy rosary","decade"],time:"evening",guided:"rosary",
   why:"The Gospel prayed on beads; the lips carry the words while the mind rests on the mysteries.",
   does:"Reciting the Ave Maria slows breathing to about six a minute, the rate that most settles the heart."},

  {id:"chaplet",title:"The Divine Mercy Chaplet",tags:["divine mercy","chaplet","mercy"],time:"afternoon",guided:"chaplet",
   why:"Prayed at three o'clock, the hour of mercy, on ordinary rosary beads.",
   does:"A fixed hour and a fixed form make a practice survive the days you don't feel like it."},

  {id:"examen",title:"The Examen",tags:["examen","evening examen","examination"],time:"night",guided:"examen",
   why:"St. Ignatius' nightly review: gratitude, light, the day, sorrow, resolve.",
   does:"A brief review before sleep is how the day is consolidated and tomorrow is shaped."},

  {id:"contrition",title:"Act of Contrition",tags:["contrition","act of contrition"],time:"night",
   why:"Sorrow for sin, said in words, is the beginning of every return.",
   does:"Naming a fault out loud changes it from a mood into something you can act on.",
   body:[ACT_OF_CONTRITION]},

  {id:"night",title:"Night Prayer",latin:"Compline",tags:["night prayer","night prayers","compline","bedtime","evening prayer"],time:"night",
   why:"The day is placed in God's hands before sleep, as the monks have done every night for fifteen centuries.",
   does:"A closing ritual signals the end of the day to a body that otherwise doesn't know.",
   body:[ACT_OF_CONTRITION,
         "Into Thy hands, O Lord, I commend my spirit. Protect us, Lord, as we stay awake; watch over us as we sleep: that awake, we may keep watch with Christ, and asleep, rest in His peace.",
         "May the Lord grant us a quiet night and a peaceful death. Amen.",
         OUR_FATHER, HAIL_MARY, GLORY_BE]},

  {id:"michael",title:"Prayer to St. Michael",tags:["st michael","michael","saint michael"],
   why:"Asked of the whole Church by Leo XIII, said at the end of Mass for a century.",
   does:"A short, memorised prayer is available in the moment a long one is not.",
   body:["St. Michael the Archangel, defend us in battle; be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do thou, O Prince of the heavenly host, by the power of God, cast into hell Satan and all the evil spirits who prowl about the world seeking the ruin of souls. Amen."]},

  {id:"memorare",title:"The Memorare",tags:["memorare"],
   why:"St. Bernard's confident appeal to Our Lady; the Church has never known it to fail.",
   does:"Confidence, spoken, is itself a change in the one who speaks it.",
   body:["Remember, O most gracious Virgin Mary, that never was it known that anyone who fled to thy protection, implored thy help, or sought thy intercession was left unaided. Inspired by this confidence, I fly unto thee, O Virgin of virgins, my Mother; to thee do I come, before thee I stand, sinful and sorrowful. O Mother of the Word Incarnate, despise not my petitions, but in thy mercy hear and answer me. Amen."]},

  {id:"anima",title:"Anima Christi",tags:["anima christi","after communion"],
   why:"Prayed after Holy Communion since the fourteenth century.",
   does:"A set form after a significant act marks it, and marked acts are remembered.",
   body:["Soul of Christ, sanctify me. Body of Christ, save me. Blood of Christ, inebriate me. Water from the side of Christ, wash me. Passion of Christ, strengthen me. O good Jesus, hear me. Within Thy wounds hide me. Suffer me not to be separated from Thee. From the malicious enemy defend me. In the hour of my death call me, and bid me come unto Thee, that with Thy saints I may praise Thee for ever and ever. Amen."]},

  {id:"guardian",title:"Prayer to the Guardian Angel",tags:["guardian angel","angel"],time:"night",
   why:"The first prayer most Catholic children learn, and the last many say.",
   does:"A prayer learned in childhood is stored differently and lasts a lifetime.",
   body:["Angel of God, my guardian dear, to whom God's love commits me here, ever this day be at my side, to light and guard, to rule and guide. Amen."]},

  {id:"grace",title:"Grace Before Meals",tags:["grace","before meals","dinner","meal"],time:"meal",
   why:"Every meal received as a gift, as the Lord blessed the loaves.",
   does:"A pause before eating slows the meal; slower meals are eaten with more attention.",
   body:["Bless us, O Lord, and these Thy gifts, which we are about to receive from Thy bounty, through Christ our Lord. Amen.",
         "After the meal: We give Thee thanks, almighty God, for all Thy benefits, who livest and reignest world without end. Amen. May the souls of the faithful departed, through the mercy of God, rest in peace. Amen."]},

  {id:"creed",title:"The Apostles' Creed",tags:["creed","apostles creed"],
   why:"The faith of the Church in twelve articles, older than any of us.",
   does:"Saying what you believe aloud, regularly, is how a belief stays yours.",
   body:[APOSTLES_CREED]},

  {id:"salve",title:"Hail, Holy Queen",latin:"Salve Regina",tags:["hail holy queen","salve regina","salve"],
   why:"Sung at the close of the day in monasteries since the eleventh century.",
   does:"Ending on the same words every night is the oldest sleep cue there is.",
   body:[HAIL_HOLY_QUEEN]}
];

/** Loose match of a practice name to a prayer: "Evening Rosary" → the Rosary. */
export function findPrayer(name){
  const n=(name||"").toLowerCase();
  if(!n)return null;
  return PRAYERS.find(p=>p.tags.some(t=>n.includes(t)))||null;
}
export const prayerById=id=>PRAYERS.find(p=>p.id===id)||null;

/* ---------------- guided flows ----------------
   Each step: { title, text, count? } — count means "say this N times", shown as a
   tap counter (ten Hail Marys). Steps are built at run time because the Rosary's
   mysteries depend on the day. */

export function rosarySteps(mysteries){
  const steps=[
    {title:"The Sign of the Cross",text:SIGN_OF_CROSS},
    {title:"The Apostles' Creed",text:APOSTLES_CREED},
    {title:"Our Father",text:OUR_FATHER},
    {title:"Hail Mary",sub:"for faith, hope, and charity",text:HAIL_MARY,count:3},
    {title:"Glory Be",text:GLORY_BE}
  ];
  mysteries.items.forEach(([name,fruit,ref],i)=>{
    steps.push({title:`The ${["First","Second","Third","Fourth","Fifth"][i]} Mystery`,mystery:name,fruit,ref,text:`${name}.\nFruit of the mystery: ${fruit}.\n${ref}.`});
    steps.push({title:"Our Father",text:OUR_FATHER});
    steps.push({title:"Hail Mary",sub:name,text:HAIL_MARY,count:10});
    steps.push({title:"Glory Be",text:GLORY_BE});
    steps.push({title:"Fatima Prayer",text:FATIMA});
  });
  steps.push({title:"Hail, Holy Queen",text:HAIL_HOLY_QUEEN});
  steps.push({title:"Closing Prayer",text:ROSARY_CLOSING});
  steps.push({title:"The Sign of the Cross",text:SIGN_OF_CROSS,last:true});
  return steps;
}

export function chapletSteps(){
  const ETERNAL="Eternal Father, I offer Thee the Body and Blood, Soul and Divinity of Thy dearly beloved Son, Our Lord Jesus Christ, in atonement for our sins and those of the whole world.";
  const PASSION="For the sake of His sorrowful Passion, have mercy on us and on the whole world.";
  const steps=[
    {title:"The Sign of the Cross",text:SIGN_OF_CROSS},
    {title:"Opening",text:"You expired, Jesus, but the source of life gushed forth for souls, and the ocean of mercy opened up for the whole world. O Fount of Life, unfathomable Divine Mercy, envelop the whole world and empty Thyself out upon us.\n\nO Blood and Water, which gushed forth from the Heart of Jesus as a fount of mercy for us, I trust in Thee.",},
    {title:"Our Father",text:OUR_FATHER},
    {title:"Hail Mary",text:HAIL_MARY},
    {title:"The Apostles' Creed",text:APOSTLES_CREED}
  ];
  for(let i=1;i<=5;i++){
    steps.push({title:`Decade ${i} · Eternal Father`,text:ETERNAL});
    steps.push({title:`Decade ${i}`,sub:"on the ten small beads",text:PASSION,count:10});
  }
  steps.push({title:"Holy God",text:"Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.",count:3});
  steps.push({title:"Closing",text:"Eternal God, in whom mercy is endless and the treasury of compassion inexhaustible, look kindly upon us and increase Thy mercy in us, that in difficult moments we might not despair nor become despondent, but with great confidence submit ourselves to Thy holy will, which is Love and Mercy itself. Amen."});
  steps.push({title:"The Sign of the Cross",text:SIGN_OF_CROSS,last:true});
  return steps;
}

/** The Examen: five movements, each with a prompt; the last step saves a note. */
export function examenSteps(question){
  return [
    {title:"Become still",text:"Place yourself in God's presence. He has been with you all day, whether you noticed or not.\n\n"+SIGN_OF_CROSS},
    {title:"Give thanks",text:"Look back over the day and find its gifts: a meal, a face, a moment of quiet, a thing that went right. Thank God for each by name."},
    {title:"Ask for light",text:"Ask the Holy Spirit to show you the day as He saw it, not as you'd prefer to remember it."},
    {title:"Review the day",text:"Walk through it from waking to now. Where did you meet Christ? Where did you turn away?\n\nTonight's question: "+question,prompt:true},
    {title:"Sorrow and mercy",text:ACT_OF_CONTRITION},
    {title:"Resolve",text:"One concrete thing for tomorrow. Small. Sayable in a sentence.\n\nThen: "+OUR_FATHER,last:true}
  ];
}
