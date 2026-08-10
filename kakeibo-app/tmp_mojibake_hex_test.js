const hex = 'c3a5e280a6e280b0c3a7e280a0c2b1c3a8c2b2c2bb';
const buf = Buffer.from(hex, 'hex');
console.log('raw utf8:', buf.toString('utf8'));
const latin = Buffer.from(buf.toString('binary'), 'latin1');
console.log('latin to utf8:', latin.toString('utf8'));
console.log('latin hex:', latin.toString('hex'));
