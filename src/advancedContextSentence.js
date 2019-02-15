"use strict";

// ==UserScript==
// @name         Advanced Context Sentence [local]
// @namespace    https://openuserjs.org/users/abdullahalt
// @version      1.32
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
  //--------------------------------------------------------------------------------------------------------------//
  //-----------------------------------------------INITIALIZATION-------------------------------------------------//
  //--------------------------------------------------------------------------------------------------------------//
  const wkof = window.wkof;
  const jfff = window.jlpt_joyo_freq_filters;

  const scriptId = "AdvancedContextSentence";
  const scriptName = "Advanced Context Sentence";
  const vocabularyPage = "/vocabulary";
  const sessions = [
    {
      page: "/review/session",
      mount: "#item-info-col2",
      loading: "#loading",
      getHeader: sentences => {
        return sentences[0].previousElementSibling;
      }
    },
    {
      page: "/lesson/session",
      mount: "#supplement-voc-context-sentence",
      loading: "#loading-screen",
      getHeader: sentences => {
        return sentences[0].parentElement.previousElementSibling;
      }
    }
  ];

  let state = {
    settings: {
      guruedKanjiColor: "#f100a1",
      unguruedKanjiColor: "#888888"
    },
    kanjis: []
  };

  // Application start Point
  main();

  function main() {
    // we don't need to observe any changes in the vocabulary page
    if (isPage(vocabularyPage)) {
      init(() =>
        evolveContextSentence(sentences => {
          return sentences[0].previousElementSibling;
        })
      );
      return;
    }

    // Get the target for the session page to watch for changes
    const session = getSessionDependingOnPage();
    if (session) startObserving(session);
  }

  function startObserving({ mount, loading, getHeader }) {
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
      init(() => {
        observeSentenceChanges();
      });
    };

    const observeSentenceChanges = () => {
      observeChanges({
        element: mount,
        continuesObservation: true,
        config: itemInfoObservationConfiguration,
        onChange: () => evolve(),
        onInitObserver: () => evolve()
      });
    };

    const evolve = () => evolveContextSentence(getHeader);

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
    createReferrer();
    createStyle();

    if (wkof) {
      wkof.include("ItemData,Settings");
      wkof
        .ready("ItemData,Settings")
        .then(loadSettings)
        .then(proccessLoadedSettings)
        .then(getGuruedKanji)
        .then(extractKanjiFromResponse)
        .then(callback);
    } else {
      console.warn(
        `${scriptName}: You are not using Wanikani Open Framework which this script utlizes to see the kanji you learned and highlights it with a different color, it also provides the settings dailog for the scrip. You can still use Advanced Context Sentence normally though`
      );
      callback();
    }
  }

  function evolveContextSentence(getHeader) {
    const sentences = document.querySelectorAll(".context-sentence-group");
    if (sentences.length === 0) return;

    if (wkof) evolveHeader(getHeader(sentences));

    sentences.forEach(sentence => {
      const japaneseSentence = sentence.querySelector('p[lang="ja"]');
      const audioButton = createAudioButton(japaneseSentence.innerHTML);
      let advancedExampleSentence = "";
      const chars = japaneseSentence.innerHTML.split("");
      chars.forEach(char => {
        const renderedChar = tagAndLinkKanji(char);
        advancedExampleSentence = advancedExampleSentence.concat(renderedChar);
      });

      japaneseSentence.innerHTML = advancedExampleSentence;
      highlightKanji();

      japaneseSentence.append(audioButton);
    });
  }

  function evolveHeader(header) {
    const settings = document.createElement("i");
    settings.setAttribute("class", "icon-gear");
    settings.setAttribute(
      "style",
      "font-size: 14px; cursor: pointer; vertical-align: middle; margin-left: 10px;"
    );
    settings.onclick = openSettings;

    if (!header.querySelector("i.icon-gear")) header.append(settings);
  }

  /**
   * To fix a weird issue that occur in the session pages(where all audios play
   * if the audio for reading the word is clicked),
   * we have to create the audio element only for the time of palying the audio
   * and remove it afterward
   * @param {*} sentence
   */
  function createAudioButton(sentence) {
    // contains audio and button as sibiling elements
    const audioContainer = document.createElement("span");

    const mpegSource = createSource("audio/mpeg", sentence);
    const oogSource = createSource("audio/oog", sentence);

    const button = document.createElement("button");
    button.setAttribute("class", "audio-btn audio-idle");

    button.onclick = () => {
      if (audioContainer.childElementCount > 1) {
        const audio = audioContainer.querySelector("audio");
        audio.pause();
        button.setAttribute("class", "audio-btn audio-idle");
        audio.remove();
        return;
      }

      const audio = document.createElement("audio");
      audio.setAttribute("display", "none");
      audio.append(mpegSource, oogSource);

      audio.onplay = () => {
        button.setAttribute("class", "audio-btn audio-play");
      };

      audio.onended = () => {
        button.setAttribute("class", "audio-btn audio-idle");
        audio.remove();
      };

      audioContainer.append(audio);
      audio.play();
    };

    audioContainer.append(button);
    return audioContainer;
  }

  function fixSessionAudio() {
    const button = document.querySelector("#option-audio span button");
    const audio = document.querySelector("#option-audio span audio");
    button.onclick = e => {
      audio.play();
    };
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
        `${scriptName}: you're browser does not support MutationObserver which this script utilaizes to implement its features in /lesson/session and /review/sesson. update you're broswer or use another one if you want Advanced Context Sentence to work on them. This script is still useful on /vocabulary page though`
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

  //--------------------------------------------------------------------------------------------------------------//
  //----------------------------------------------SETTINGS--------------------------------------------------------//
  //--------------------------------------------------------------------------------------------------------------//

  function loadSettings() {
    return wkof.Settings.load(scriptId, state.settings);
  }

  function proccessLoadedSettings() {
    state.settings = wkof.settings[scriptId];
  }

  function openSettings() {
    var config = {
      script_id: scriptId,
      title: scriptName,
      on_save: updateSettings,
      content: {
        highlightColors: {
          type: "section",
          label: "Highlight Colors" // A string that will appear in the section.
        },
        guruedKanjiColor: {
          type: "color",
          label: "Gurued Kanji",
          hover_tip:
            "Kanji you have on Guru or higher will be highlited using this color",
          default: state.settings.guruedKanjiColor
        },
        unguruedKanjiColor: {
          type: "color",
          label: "Ungurued Kanji",
          hover_tip:
            "Kanji you have on Apprentice or have never been unlucked will be highlited using this color",
          default: state.settings.unguruedKanjiColor
        }
      }
    };
    var dialog = new wkof.Settings(config);
    dialog.open();
  }

  // Called when the user clicks the Save button on the Settings dialog.
  function updateSettings() {
    state.settings = wkof.settings[scriptId];
    highlightKanji();
  }

  //---------------------------------------------------------------------------------------------------------------//
  //-------------------------------------------HELPER FUNCTIONS----------------------------------------------------//
  //---------------------------------------------------------------------------------------------------------------//

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

  function tagAndLinkKanji(char) {
    return isKanji(char) ? renderKanji(char) : char;
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
  function renderKanji(char) {
    const kanji = state.kanjis.find(item => item.char == char);

    const tooltip = createTooltip(kanji);
    return `<a href="${
      kanji ? kanji.url : `https://jisho.org/search/${char}`
    }" target="_blank" class="${
      !wkof || (kanji && kanji.srs > 4) ? "guruedKanji" : "unguruedKanji"
    } acs-tooltip-target">${char}${tooltip}</a>`;
  }

  function createTooltip(kanji) {
    if (!wkof) return "";

    if (!kanji) {
      return `
        <div class="acs-tooltip">
          <span>Wanikani doesn't have this kanji! :(</span>
        </div>
      `;
    }

    const onyomis = kanji.readings.filter(
      item => item.type.toLocaleLowerCase() === "onyomi"
    );
    const kunyomis = kanji.readings.filter(
      item => item.type.toLocaleLowerCase() === "kunyomi"
    );

    const onyomi = stringfyArray(onyomis, item => item.reading);
    const kunyomi = stringfyArray(kunyomis, item => item.reading);
    const meaning = stringfyArray(kanji.meanings, item => item.meaning);

    console.log("createTooltip");
    return `<div class="acs-tooltip">
        ${generateInfo("LV", kanji.level)}
        ${generateInfo("EN", meaning)}
        ${onyomi !== "None" && onyomi !== "" ? generateInfo("ON", onyomi) : ""}
        ${
          kunyomi !== "None" && kunyomi !== ""
            ? generateInfo("KN", kunyomi)
            : ""
        }
        ${wkof && jfff ? generateInfo("JOYO", kanji.joyo) : ""}
        ${wkof && jfff ? generateInfo("JLPT", kanji.jlpt) : ""}
        ${wkof && jfff ? generateInfo("FREQ", kanji.frequency) : ""}
      </div>`;
  }

  function stringfyArray(array, pathToString) {
    let stringfied = "";
    array.forEach(item => {
      stringfied = stringfied.concat(pathToString(item) + ", ");
    });
    stringfied = stringfied.substring(0, stringfied.length - 2);
    return stringfied;
  }

  function generateInfo(title, info) {
    return `
      <div>
        <span class="acs-tooltip-title">${title}</span>
        <span>${info}</span>
      </div>
    `;
  }

  function getGuruedKanji() {
    const filters = {
      item_type: ["kan"]
    };

    if (jfff) {
      console.log("getGuruedKanji");
      filters.include_frequency_data = true;
      filters.include_jlpt_data = true;
      filters.include_joyo_data = true;
    } else {
      console.warn(
        `${scriptName}: You don't have Open Framework JLPT Joyo and Frequency Filters by @Kumirei installed (version 0.1.3 or later). Install the script if you want to get more information while hovering on Kanji on Context Sentences. Script URL: https://community.wanikani.com/t/userscript-open-framework-jlpt-joyo-and-frequency-filters/35096`
      );
    }

    return wkof.ItemData.get_items({
      wk_items: {
        options: {
          assignments: true
        },
        filters
      }
    });
  }

  function extractKanjiFromResponse(items) {
    const kanjis = [];

    items.forEach(item => {
      const kanji = {
        char: item.data.characters,
        readings: item.data.readings,
        level: item.data.level,
        meanings: item.data.meanings,
        url: item.data.document_url,
        srs: item.assignments ? item.assignments.srs_stage : -1,
        jlpt: item.jlpt_level,
        joyo: item.joyo_grade,
        frequency: item.frequency
      };

      kanjis.push(enhanceWithAditionalFilters(kanji, item));
    });

    state.kanjis = kanjis;
  }

  function enhanceWithAditionalFilters(kanji, item) {
    if (jfff) {
      console.log("enhanceWithAditionalFilters");
      kanji.jlpt = item.jlpt_level;
      kanji.joyo = item.joyo_grade;
      kanji.frequency = item.frequency;
    }
    return kanji;
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

  function highlightKanji() {
    const gurued = document.querySelectorAll(
      ".context-sentence-group a.guruedKanji"
    );
    gurued.forEach(kanji => {
      kanji.setAttribute(
        "style",
        `color: ${state.settings.guruedKanjiColor} !important`
      );
    });

    const ungurued = document.querySelectorAll(
      ".context-sentence-group a.unguruedKanji"
    );
    ungurued.forEach(kanji => {
      kanji.setAttribute(
        "style",
        `color: ${state.settings.unguruedKanjiColor} !important`
      );
    });
  }

  // Neccessary in order for audio to work
  function createReferrer() {
    const remRef = document.createElement("meta");
    remRef.name = "referrer";
    remRef.content = "no-referrer";
    document.querySelector("head").append(remRef);
  }

  // Styles
  function createStyle() {
    const style = document.createElement("style");
    style.innerHTML = `
      
      /* Kanji */
      .context-sentence-group p a {
        text-decoration: none;
      }

      .context-sentence-group p a:hover {
        text-decoration: none;
      }
      
      /* Styling Tooltip */

      .acs-tooltip-target {
        position: relative;
        display: inline-block;
      }

      .acs-tooltip-target:hover .acs-tooltip {
        visibility: visible;
      }
      
      .acs-tooltip-target .acs-tooltip {
        visibility: hidden;
        width: 120px;
        background-color: rgba(0,0,0,0.8);
        color: #fff;
        padding: 5px 7px;
        border-radius: 6px;
        width: 120px;
        top: 100%;
        left: 50%;
        margin-left: -67px;
        margin-top: 10px;
        position: absolute;
        text-shadow: none;
        font-size: 0.8em;
        z-index: 1;
      }

      .acs-tooltip-target .acs-tooltip::after {
        content: " ";
        position: absolute;
        bottom: 100%;  
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: transparent transparent black transparent;
      }

      .acs-tooltip-target .acs-tooltip div {
        margin-bottom: 0px;
        line-height: 16px;
      }

      .acs-tooltip-target .acs-tooltip .acs-tooltip-title {
        color: #939095 !important
      }

    `;

    document.querySelector("head").append(style);
  }
})();
