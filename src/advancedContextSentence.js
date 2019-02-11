// ==UserScript==
// @name         Advanced Context Sentence [local]
// @namespace    https://openuserjs.org/users/abdullahalt
// @version      1.1
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

  const vocabularyPage = "/vocabulary";
  const sessions = [
    {
      page: "/review/session",
      mount: "#item-info-col2",
      loading: "#loading"
    },
    {
      page: "/lesson/session",
      mount: "#supplement-voc-context-sentence",
      loading: "#loading-screen"
    }
  ];

  const guruedKanjiColor = "#f100a1";
  const unguruedKanjiColor = "#888888";

  // Application start Point
  main();

  function main() {
    // we don't need to observe any changes in the vocabulary page
    if (isPage(vocabularyPage)) {
      init(guruedKanji => evolveContextSentence(guruedKanji));
      return;
    }

    // Get the target for the session page to watch for changes
    const session = getSessionDependingOnPage();
    if (session) startObserving(session);
  }

  function startObserving({ mount, loading }) {
    const loadingObservationConfiguration = {
      attributes: true,
      childList: false,
      subtree: false
    };

    const itemInfoObservationConfiguration = {
      attributes: false,
      childList: true,
      subtree: false
    };

    const observeLoading = () => {
      observeChanges({
        element: loading,
        config: loadingObservationConfiguration,
        onChange: runInit
      });
    };

    const runInit = () => {
      init(guruedKanji => {
        observeSentenceChanges(guruedKanji);
      });
    };

    const observeSentenceChanges = guruedKanji => {
      observeChanges({
        element: mount,
        continuesObservation: true,
        config: itemInfoObservationConfiguration,
        onChange: () => evolve(guruedKanji),
        onInitObserver: () => evolve(guruedKanji)
      });
    };

    const evolve = guruedKanji => evolveContextSentence(guruedKanji);

    /**
     * Basically, this function will fire an observer that will
     * watch when the loading screen on the session pages (lesson and review) stops,
     * then it will fire another observer to watch for changing the sentences,
     * whenever the sentence change it will fire the evolveContextSentence over it again
     *
     * why wait for the loading screen stops? because the script slows down the animation
     * which makes a really bad user experience
     */
    observeLoading();
  }

  function init(callback) {
    if (wkof) {
      wkof.include("ItemData");
      wkof
        .ready("ItemData")
        .then(getGuruedKanji)
        .then(extractKanjiFromResponse)
        .then(callback);
    } else {
      console.warn(
        "Advanced Context Sentence: You are not using Wanikani Open Framework which " +
          "this script utlizes to see the kanji you learned and highlights it with a different color. " +
          "You can still use Advanced Context Sentence normally though"
      );
      callback();
    }
  }

  function evolveContextSentence(guruedKanji = null) {
    createReferrer();
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
    const mpegSource = createSource("audio/mpeg", sentence);
    const oogSource = createSource("audio/oog", sentence);

    const audio = document.createElement("audio");
    audio.setAttribute("display", "none");
    audio.append(mpegSource, oogSource);

    const button = document.createElement("button");
    button.setAttribute("class", "audio-btn audio-idle");

    // Handle events
    button.onclick = () => audio.play();
    audio.onplay = () => button.setAttribute("class", "audio-btn audio-play");
    audio.onended = () => button.setAttribute("class", "audio-btn audio-idle");

    // return audio and button as sibiling elements
    const audioContainer = document.createElement("span");
    audioContainer.append(button, audio);
    return audioContainer;
  }

  function observeChanges(params) {
    const {
      element,
      config,
      onChange,
      onInitObserver = () => {},
      continuesObservation = false
    } = params;

    if (!window.MutationObserver) {
      console.warn(
        "Advanced Context Sentence: you're browser does not support MutationObserver " +
          "which this script utilaizes to implement its features in /lesson/session and /review/sesson. " +
          "update you're broswer or use another one if you want Advanced Context Sentence to work on them." +
          "This script is still useful on /vocabulary page though"
      );
      return;
    }

    onInitObserver();

    const target = document.querySelector(element);
    const observer = new MutationObserver(() => {
      observer.disconnect();
      onChange();
      continuesObservation && observer.observe(target, config);
    });

    observer.observe(target, config);
  }

  //-----------------------------------------------------------------------------------------------------------------------------------------------------//
  //-------------------------------------------------------------------HELPER FUNCTIONS------------------------------------------------------------------//
  //-----------------------------------------------------------------------------------------------------------------------------------------------------//

  function isPage(page) {
    const path = window.location.pathname;
    return path.includes(page);
  }

  function getSessionDependingOnPage() {
    let result = null;
    sessions.forEach(session => {
      if (isPage(session.page)) result = session;
    });

    return result;
  }

  function highlightAndLinkKanji(char, guruedKanji) {
    let renderedChar = char;
    if (isKanji(char)) {
      renderedChar = isAtLeastGuru(char, guruedKanji)
        ? renderKanji(char, guruedKanjiColor)
        : renderKanji(char, unguruedKanjiColor);
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

  function createSource(type, sentence) {
    const source = document.createElement("source");
    source.setAttribute("type", type);
    source.setAttribute(
      "src",
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&total=1&idx=0&q=${sentence}`
    );
    return source;
  }

  // Neccessary in order for audio to work
  function createReferrer() {
    const remRef = document.createElement("meta");
    remRef.name = "referrer";
    remRef.content = "no-referrer";
    document.querySelector("head").append(remRef);
  }
})();
