const samples = [
  'å…‰ç†±è²»',
  'æ°´é“ä»£',
  'é€šä¿¡è²»',
  'ã‚µãƒ–ã‚¹ã‚¯',
  'å¥¨å¦é‡‘',
  'ä¿å®…',
  'é£Ÿè²»',
  'æ—¥ç”¨å“',
  'é›‘è²»',
  'è¶£å‘³ãƒ»å¨¯æ¥½',
  'äº¤éš›è²»',
  'è¡£æœãƒ»ç¾Žå®¹',
  'å¥åº·ãƒ»åŒ»ç™‚',
  'äº¤é€šè²»',
  'ãµã‚‹ã•ã¨ç´ç¨Ž'
];

for (const s of samples) {
  const latin1 = Buffer.from(s, 'latin1');
  const utf8 = latin1.toString('utf8');
  const binary = Buffer.from(s, 'binary').toString('utf8');
  console.log('orig:', s);
  console.log('latin1->utf8:', utf8);
  console.log('binary->utf8:', binary);
  console.log('hex utf8:', Buffer.from(s, 'utf8').toString('hex'));
  console.log('hex latin1:', Buffer.from(s, 'latin1').toString('hex'));
  console.log('---');
}
