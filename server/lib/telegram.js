function escTg(str) {
  return String(str).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function splitTgMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

module.exports = { escTg, splitTgMessage };
