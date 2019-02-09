// ==UserScript==
// @name         Advanced Context Sentence
// @namespace    https://openuserjs.org/users/abdullahalt
// @version      1.01
// @description  Link the kanji page for the kanji in the context sentence section
// @author       abdullahalt
// @match        https://www.wanikani.com/lesson/session
// @match        https://www.wanikani.com/review/session
// @match        https://www.wanikani.com/vocabulary/*
// @grant        none
// @copyright    2019, abdullahalt (https://openuserjs.org//users/abdullahalt)
// @license MIT
// ==/UserScript==

// ==OpenUserJS==
// @author abdullahalt
// ==/OpenUserJS==

(() => {
  //-----------------------------------------------------------------------------------------------------------------------------------------------------//
  //-------------------------------------------------------------------INITIALIZATION--------------------------------------------------------------------//
  //-----------------------------------------------------------------------------------------------------------------------------------------------------//
  const wkof = window.wkof;
  init();

  function init() {
    if (wkof) {
      wkof.include("ItemData");
      wkof
        .ready("ItemData")
        .then(getGuruedKanji)
        .then(extractKanjiFromResponse)
        .then(start);
    } else {
      console.warn(
        "Advanced Context Sentence: You are not using Wanikani Open Framework which " +
          "this script utlizes to see the kanji you learned and highlights it with a different color. " +
          "You can still use Advanced Context Sentence normally though"
      );
      start();
    }
  }

  function start(guruedKanji = null) {
    if (window.location.pathname === "/review/session") {
      observeChanges(
        () => evolveContextSentence(guruedKanji),
        "#item-info-col2"
      );
    }
    if (window.location.pathname === "/lesson/session") {
      evolveContextSentence(guruedKanji);
      observeChanges(
        () => evolveContextSentence(guruedKanji),
        "#supplement-voc-context-sentence"
      );
    } else {
      evolveContextSentence(guruedKanji);
    }
  }

  function evolveContextSentence(guruedKanji) {
    const sentences = document.querySelectorAll(".context-sentence-group");

    if (sentences.length === 0) return;

    sentences.forEach(sentence => {
      const japaneseSentence = sentence.querySelector('p[lang="ja"]');
      const audioButton = createAudioButton(japaneseSentence.innerHTML);
      let advancedExampleSentence = "";
      const chars = japaneseSentence.innerHTML.split("");
      chars.forEach(char => {
        const renderedChar = highlightAndLinkKanji(char, guruedKanji);
        advancedExampleSentence = advancedExampleSentence.concat(renderedChar);
      });

      japaneseSentence.innerHTML = advancedExampleSentence;

      audioButton && japaneseSentence.append(audioButton);
    });
  }

  function createAudioButton(sentence) {
    if (!window.SpeechSynthesisUtterance) {
      console.warn(
        "Advanced Context Sentence: your browser does not support SpeechSynthesisUtterance " +
          "which this script utilaizes to implement the audio feature. update your broswer or use another one if you want that feature"
      );
      return null;
    }

    const button = document.createElement("button");
    button.setAttribute("class", "audio-btn audio-idle");

    button.onclick = () => {
      const msg = new SpeechSynthesisUtterance(sentence);
      msg.lang = "ja-JP";
      msg.rate = 11;
      window.speechSynthesis.speak(msg);
      msg.onstart = () => {
        button.setAttribute("class", "audio-btn audio-play");
      };
      msg.onend = () => {
        button.setAttribute("class", "audio-btn audio-idle");
      };
    };
    return button;
  }

  function observeChanges(callback, element) {
    if (!window.MutationObserver) {
      console.warn(
        "Advanced Context Sentence: you're browser does not support MutationObserver " +
          "which this script utilaizes to implement its features in /lesson/session and /review/sesson. " +
          "update you're broswer or use another one if you want Advanced Context Sentence to work on them." +
          "This script is still useful on /vocabulary page though"
      );
      return;
    }

    const target = document.querySelector(element);
    const config = {
      attributes: false,
      childList: true,
      subtree: true
    };

    const observer = new MutationObserver(() => {
      observer.disconnect();
      callback();
      observer.observe(target, config);
    });

    observer.observe(target, config);
  }

  //-----------------------------------------------------------------------------------------------------------------------------------------------------//
  //-------------------------------------------------------------------HELPER FUNCTIONS------------------------------------------------------------------//
  //-----------------------------------------------------------------------------------------------------------------------------------------------------//

  function highlightAndLinkKanji(char, guruedKanji) {
    let renderedChar = char;
    if (isKanji(char)) {
      renderedChar = isAtLeastGuru(char, guruedKanji)
        ? renderKanji(char, "#f100a1")
        : renderKanji(char, "#a100f1");
    }
    return renderedChar;
  }

  /**
   * Determine if the character is a Kanji, inspired by https://stackoverflow.com/a/15034560
   */
  function isKanji(char) {
    return isCommonOrUncommonKanji(char) || isRareKanji(char);
  }

  function isCommonOrUncommonKanji(char) {
    return char >= "\u4e00" && char <= "\u9faf";
  }

  function isRareKanji(char) {
    char >= "\u3400" && char <= "\u4dbf";
  }

  /**
   * Renders the link for a kanji you've gurued
   * Knji pages always use https://www.wanikani.com/kanji/{kanji} where {kanji} is the kanji character
   */
  function renderKanji(kanji, color) {
    return `<a href="https://www.wanikani.com/kanji/${kanji}" target="_blank" style="color: ${color}" title="go to kanji page">${kanji}</a>`;
  }

  function isAtLeastGuru(char, guruedKanji) {
    if (!guruedKanji) return false;
    return guruedKanji.includes(char);
  }

  function getGuruedKanji() {
    return wkof.ItemData.get_items({
      wk_items: {
        filters: {
          item_type: ["kan"],
          srs: ["guru1", "guru2", "mast", "enli", "burn"]
        }
      }
    });
  }

  function extractKanjiFromResponse(items) {
    const kanjis = [];
    items.forEach(item => {
      kanjis.push(item.data.characters);
    });
    return kanjis;
  }
})();
