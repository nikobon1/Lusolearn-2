# Частотный словарь (европейский португальский)

`data/frequencyDictionary.json` собирается из двух частей:

1. **Леммы и переводы** — вручную, в `lemmas/*.txt`:
   ```
   лемма|часть речи|перевод на русский|доп. формы через пробел
   a casa|noun|дом|
   fazer|verb!|делать|faço fazes faz ...   # verb! = неправильный глагол, формы перечислены явно
   falar|verb|говорить|                    # формы правильных глаголов генерируются автоматически
   ```
   Части речи: `verb noun adj adv pron prep conj det num interj phrase`.
2. **Ранги** — частоты словоформ из субтитров OpenSubtitles (pt), список
   [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (`content/2018/pt/pt_50k.txt`).
   Частота леммы = сумма частот всех её форм (спряжения, род, число).

## Пересборка

```bash
curl -sSo /tmp/pt_50k.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pt/pt_50k.txt
python3 scripts/frequency/build.py /tmp/pt_50k.txt --gaps 300
```

`--gaps N` печатает N самых частых словоформ, которые не покрыты ни одной леммой, —
по ним удобно дополнять `lemmas/`.

Сейчас: ~1650 лемм, покрывают ~86% всех слов корпуса.
