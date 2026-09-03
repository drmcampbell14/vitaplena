/* Vita Plena — liturgical calendar math. Pure: no Firebase, no DOM.
   easter() is the Anonymous Gregorian algorithm. season() returns the liturgical
   season for a date using the current (1969) calendar; the 1962 calendar and
   feast/rank data arrive with romcal in Phase 2. SAINTS is the hand-kept fallback. */

export function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da);}
export function addD(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
export function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
export function season(d){
  const y=d.getFullYear(), E=easter(y);
  const ash=addD(E,-46), holyThu=addD(E,-3), pent=addD(E,49);
  const xmas=new Date(y,11,25);
  let adv=new Date(y,11,25); adv=addD(adv,-(adv.getDay()||7)); adv=addD(adv,-21);
  const epiph=new Date(y,0,6); let bapt=addD(epiph,7-epiph.getDay()||7); if(epiph.getDay()===0) bapt=addD(epiph,7);
  const t=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const cmp=(a,b)=>a.getTime()-new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime();
  if(cmp(t,new Date(y,0,1))>=0 && cmp(t,bapt)<=0) return {name:"Christmas"};
  if(cmp(t,ash)>=0 && cmp(t,holyThu)<0) return {name:"Lent"};
  if(cmp(t,holyThu)>=0 && cmp(t,E)<0) return {name:"Sacred Triduum"};
  if(cmp(t,E)>=0 && cmp(t,pent)<0) return {name:"Easter"};
  if(cmp(t,pent)===0) return {name:"Pentecost"};
  if(cmp(t,adv)>=0 && cmp(t,xmas)<0) return {name:"Advent"};
  if(cmp(t,xmas)>=0) return {name:"Christmas"};
  return {name:"Ordinary Time"};
}

export const SAINTS={ "01-01":"Mary, Mother of God","01-02":"Ss. Basil & Gregory Nazianzen","01-04":"St. Elizabeth Ann Seton","01-05":"St. John Neumann","01-17":"St. Anthony of Egypt","01-21":"St. Agnes","01-24":"St. Francis de Sales","01-25":"Conversion of St. Paul","01-26":"Ss. Timothy & Titus","01-28":"St. Thomas Aquinas","01-31":"St. John Bosco",
"02-02":"Presentation of the Lord","02-03":"St. Blaise","02-05":"St. Agatha","02-06":"St. Paul Miki & Companions","02-10":"St. Scholastica","02-11":"Our Lady of Lourdes","02-14":"Ss. Cyril & Methodius","02-22":"Chair of St. Peter","02-23":"St. Polycarp",
"03-03":"St. Katharine Drexel","03-07":"Ss. Perpetua & Felicity","03-17":"St. Patrick","03-19":"St. Joseph","03-25":"The Annunciation",
"04-04":"St. Isidore of Seville","04-07":"St. John Baptist de la Salle","04-11":"St. Stanislaus","04-21":"St. Anselm","04-23":"St. George","04-25":"St. Mark","04-29":"St. Catherine of Siena","04-30":"St. Pius V",
"05-01":"St. Joseph the Worker","05-02":"St. Athanasius","05-03":"Ss. Philip & James","05-10":"St. Damien of Molokai","05-13":"Our Lady of Fatima","05-14":"St. Matthias","05-15":"St. Isidore the Farmer","05-22":"St. Rita of Cascia","05-26":"St. Philip Neri","05-30":"St. Joan of Arc","05-31":"The Visitation",
"06-01":"St. Justin Martyr","06-03":"St. Charles Lwanga & Companions","06-05":"St. Boniface","06-11":"St. Barnabas","06-13":"St. Anthony of Padua","06-21":"St. Aloysius Gonzaga","06-22":"Ss. John Fisher & Thomas More","06-24":"Nativity of St. John the Baptist","06-28":"St. Irenaeus","06-29":"Ss. Peter & Paul",
"07-01":"St. Junipero Serra","07-03":"St. Thomas the Apostle","07-06":"St. Maria Goretti","07-11":"St. Benedict","07-14":"St. Kateri Tekakwitha","07-15":"St. Bonaventure","07-16":"Our Lady of Mt. Carmel","07-22":"St. Mary Magdalene","07-23":"St. Bridget of Sweden","07-25":"St. James","07-26":"Ss. Joachim & Anne","07-29":"Ss. Martha, Mary & Lazarus","07-31":"St. Ignatius of Loyola",
"08-01":"St. Alphonsus Liguori","08-04":"St. John Vianney","08-06":"Transfiguration of the Lord","08-08":"St. Dominic","08-09":"St. Teresa Benedicta (Edith Stein)","08-10":"St. Lawrence","08-11":"St. Clare","08-14":"St. Maximilian Kolbe","08-15":"Assumption of Mary","08-20":"St. Bernard of Clairvaux","08-21":"St. Pius X","08-22":"Queenship of Mary","08-27":"St. Monica","08-28":"St. Augustine","08-29":"Passion of St. John the Baptist",
"09-03":"St. Gregory the Great","09-05":"St. Teresa of Calcutta","09-08":"Nativity of Mary","09-09":"St. Peter Claver","09-13":"St. John Chrysostom","09-14":"Exaltation of the Holy Cross","09-15":"Our Lady of Sorrows","09-16":"Ss. Cornelius & Cyprian","09-21":"St. Matthew","09-23":"St. Padre Pio","09-27":"St. Vincent de Paul","09-29":"Ss. Michael, Gabriel & Raphael","09-30":"St. Jerome",
"10-01":"St. Thérèse of Lisieux","10-02":"Guardian Angels","10-04":"St. Francis of Assisi","10-05":"St. Faustina Kowalska","10-07":"Our Lady of the Rosary","10-11":"St. John XXIII","10-15":"St. Teresa of Ávila","10-16":"St. Margaret Mary Alacoque","10-17":"St. Ignatius of Antioch","10-18":"St. Luke","10-22":"St. John Paul II","10-28":"Ss. Simon & Jude",
"11-01":"All Saints","11-02":"All Souls","11-03":"St. Martin de Porres","11-04":"St. Charles Borromeo","11-09":"Dedication of the Lateran Basilica","11-10":"St. Leo the Great","11-11":"St. Martin of Tours","11-13":"St. Frances Xavier Cabrini","11-17":"St. Elizabeth of Hungary","11-21":"Presentation of Mary","11-22":"St. Cecilia","11-30":"St. Andrew",
"12-03":"St. Francis Xavier","12-06":"St. Nicholas","12-07":"St. Ambrose","12-08":"Immaculate Conception","12-09":"St. Juan Diego","12-12":"Our Lady of Guadalupe","12-13":"St. Lucy","12-14":"St. John of the Cross","12-25":"Nativity of the Lord","12-26":"St. Stephen","12-27":"St. John the Apostle","12-28":"Holy Innocents"};
