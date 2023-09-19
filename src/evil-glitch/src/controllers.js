function checkRecord(){
  newRecord = score>record;
  if(!newRecord) return;
  record = score;
  storage.setItem('evilGlitch-record', score);
}

function getRandomValue(value, offset){
  return Math.random()*(value||1) + (offset||0);
}

function randomSign(){
  return getRandomValue()>0.5?1:-1;
}

function randomGlitch(){
  var tempDuration = getRandomValue(10,5);
  GLITCHS=[tempDuration,tempDuration,tempDuration,getRandomValue(10,5),getRandomValue(10,5),getRandomValue(10,5),0];
}

function toggleControls(){
  play(heroSpeedUp);
  controlHelp = !controlHelp;
  buttons[1][3] = !controlHelp;
  buttons[3][3] = !controlHelp&&godModeAvailable;
  buttons[2][5] = controlHelp?'go back':'controls';
}
