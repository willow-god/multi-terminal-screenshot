<script setup lang="ts">
import { ref, watch } from 'vue';

//——————————————————————————————————————————————————————————————————————————————————————
const resetPreview = () => {
  activeDevice.value = ''
  coverShow.value = false
}
document.body.addEventListener('click', () => void resetPreview())

// 设备单独处理
enum Device {
  phone = 'phone',
  pad = 'pad',
  computer = 'computer',
  laptop = 'laptop' // 新增笔记本设备
}


const activeDevice = {

} = ref<Device | ''>('')

const handleActiveDevice = (device: Device) => {
  activeDevice.value = device;
  coverShow.value = true;
}

//——————————————————————————————————————————————————————————————————————————————————————

// 网址处理
const url = ref('www.liushen.fun')
const phone = ref('')
const pad = ref('')
const computer = ref('')
const laptop = ref('')
const customURL = ref(false)

watch([phone, pad, computer], () => {
  url.value = ''
})

watch(url, (n) => {
  url.value = n.replace(/http(s?)\:\/\//, '')
})

// 滚动条处理
const scrollBar = ref(false)

const coverShow = ref(false)

</script>

<template>
  <section class="main">
    <!-- 预览覆盖背景 -->
    <transition name="fade">
      <div v-if="coverShow" class="cover">
        <div class="close-preview" @click="resetPreview"><i class="iconfont icon-cancel-1-copy"></i></div>
      </div>
    </transition>
    <div class="preview-box">
      <div class="computer" :class="{ active: activeDevice === Device.computer, activated: activeDevice }"
        @click.stop="handleActiveDevice(Device.computer)">
        <iframe :src="`https://${url || computer}`" frameborder="0" :scrolling="scrollBar ? 'yes' : 'no'"></iframe>
      </div>
      <div class="laptop" :class="{ active: activeDevice === Device.laptop, activated: activeDevice }"
        @click.stop="handleActiveDevice(Device.laptop)">
        <iframe :src="`https://${url || laptop}`" frameborder="0" :scrolling="scrollBar ? 'yes' : 'no'"></iframe>
      </div>

      <div class="phone" :class="{ active: activeDevice === Device.phone, activated: activeDevice }"
        @click.stop="handleActiveDevice(Device.phone)">
        <iframe :src="`https://${url || phone}`" frameborder="0" :scrolling="scrollBar ? 'yes' : 'no'"></iframe>
      </div>
      <div class="pad" :class="{ active: activeDevice === Device.pad, activated: activeDevice }"
        @click.stop="handleActiveDevice(Device.pad)">
        <iframe :src="`https://${url || pad}`" frameborder="0" :scrolling="scrollBar ? 'yes' : 'no'"></iframe>
      </div>
    </div>
    <!-- -------------------------------------------------------------- -->
    <transition name="fade">
      <div class="controls" v-if="!activeDevice">
        <!-- 网址 -->
        <div class="url">
          <div class="default">
            <span @click.stop="customURL = !customURL" class="website" :class="{ active: customURL }">
              <i class="iconfont icon-icon_wangye"></i> 网址</span>
            <transition name="fade">
              <div style="display: inline-block ;">
                <span>https://</span>
                <input type="text" placeholder="请输入网址" v-model.trim="url" class="url">
              </div>
            </transition>
          </div>
          <transition name="fade">
            <div class="custom" v-if="customURL">
              <div class="laptop">
                <span><i class="iconfont icon-wangye"></i> 笔记本</span><span>https://</span><input type="text"
                  placeholder="请输入网址" v-model.trim="laptop" class="url">
              </div>
              <div class="phone">
                <span><i class="iconfont icon-shumashouji"></i> 手机</span><span>https://</span><input type="text"
                  placeholder="请输入网址" v-model.trim="phone" class="url">
              </div>
              <div class="pad">
                <span><i class="iconfont icon-pingban"></i> 平板</span><span>https://</span><input type="text"
                  placeholder="请输入网址" v-model.trim="pad" class="url">
              </div>
              <div class="computer">
                <span><i class="iconfont icon-diannao"></i> 电脑</span><span>https://</span><input type="text"
                  placeholder="请输入网址" v-model.trim="computer" class="url">
              </div>
              <div class="close" @click="customURL = false"><i class="iconfont icon-cancel-1-copy"></i></div>
            </div>
          </transition>
        </div>
        <!-- 滚动条 -->
        <div class="scroll-bar">
          <label>
            <div class="checkbox">
              <i class="iconfont" :class="scrollBar ? 'icon-yigouxuan' : 'icon-weigouxuan'"></i>
            </div>
            <span class="text">滚动条</span>
            <input type="checkbox" v-model="scrollBar" v-show="false" />
          </label>
        </div>
      </div>
    </transition>
  </section>
</template>

<style lang="less">
* {
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

body {
  color: #333;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  user-select: none;
}

.main {
  margin: 0 auto;

  .cover {
    top: 0;
    position: fixed;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 1);
    z-index: 100;

    .close-preview {
      position: fixed;
      width: fit-content;
      top: 40px;
      right: 40px;
      cursor: pointer;

      .iconfont {
        font-size: 26px;
      }
    }
  }

  .preview-box {
    position: relative;
    top: 200px;
    width: 1200px;
    height: 650px;
    left: 50%;
    transform: translate(-50%);
    display: flex;
    align-items: center;
    z-index: 105;
    transform-origin: 0 0;

    div {
      position: absolute;
      width: 100%;
      z-index: 1;
      overflow: hidden;
      transition: 0.5s ease;
      perspective: 1000;
      cursor: pointer;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      transform-style: preserve-3d;

      &.activated:not(.active) {
        opacity: 0;
        pointer-events: none;
      }

      iframe {
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: -1;
        left: 50%;
        border: 4px solid rgba(125, 125, 125, 0.1);

        ::-webkit-scrollbar body {
          display: none;
        }
      }
    }

    .computer {
      left: 50%;
      top: 0;
      width: 610px;
      height: 572px;
      background: url(./assets/images/new-model/computer.png) no-repeat 0 0/contain;
      transform-origin: center top;
      transform: translate(-50%);

      &.active {
        transform: translate(-50%) scale(1.2);
        z-index: 9999;
      }

      iframe {
        border-radius: 25px;
        top: 10px;
        width: 1340px;
        height: 876px;
        transform-origin: center top;
        transform: translate(-50%) scale(0.44);
      }
    }

    .laptop {
      top: 200px;
      left: 0px;
      width: 600px;
      height: 380px;
      background: url(./assets/images/new-model/laptop.png) no-repeat 0 0/contain;
      transform: scale(0.9);

      &.active {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(1.5);
        z-index: 9999;
      }

      iframe {
        border-radius: 18px 18px 5px 5px;
        top: 10px;
        width: 788px;
        height: 506px;
        transform-origin: center top;
        transform: translate(-50%) scale(0.6);
      }
    }


    .phone {
      top: 240px;
      z-index: 2;
      left: 56%;
      width: 168px;
      height: 350px;
      background: url(./assets/images/new-model/mobile.png) no-repeat 0 0/contain;
      transform: scale(0.8);

      &.active {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(2);
        z-index: 9999;
      }

      iframe {
        top: 6px;
        width: 407px;
        height: 877px;
        transform-origin: center top;
        transform: translate(calc(-50%)) scale(0.37);
        border-radius: 60px;
      }
    }

    .pad {
      top: 150px;
      left: 65%;
      width: 300px;
      height: 400px;
      background: url(./assets/images/new-model/tablet.png) no-repeat 0 0/contain;

      &.active {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(2);
        z-index: 9999;
      }

      iframe {
        top: 10px;
        width: 850px;
        height: 1120px;
        transform-origin: center top;
        transform: translate(calc(-50%)) scale(0.332);
        border-radius: 40px;
      }
    }
  }

  .controls:not(iframe) {
    position: fixed;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 70px;
    color: rgba(255, 255, 255, 0.8);
    line-height: 3;
    background-color: rgba(0, 0, 0, 0.8);
    user-select: none;
    z-index: 999;
    box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.25);

    .iconfont {
      font-size: 14px;
    }

    .url {
      display: flex;
      flex-direction: column;
      margin-left: 20px;

      .website,
      .custom span:first-child {
        margin-right: 10px;
      }

      .website {
        cursor: pointer;

        &.active {
          // color: lightskyblue;
          font-weight: 400;

          input {
            opacity: 0.4;
          }
        }
      }

      .custom {
        position: absolute;
        top: 70px;
        background-color: #333;
        margin-left: -20px;
        padding: 0 20px 5px;
        box-shadow: 0 10px 15px 0 rgba(125, 125, 125, 0.25);
        border-radius: 0 0 12px 12px;
        // border: 1px solid rgba(255, 255, 255, 0.2);
        border-top-width: 0;
        font-size: 14px;

        .close {
          margin-top: 5px;
          text-align: center;
          cursor: pointer;
        }
      }

      input {
        display: inline-block;
        width: 120px;
        height: 30px;
        padding: 4px 10px 4px 0;
        margin-left: 5px;
        font-family: Avenir, Helvetica, Arial, sans-serif;
        font-size: 16px;
        color: rgba(255, 255, 255, 0.8);
        background: none;
        border: none;
        border-radius: 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);

        &::placeholder {
          color: rgba(255, 255, 255, 0.8);
        }

        &:focus {
          outline: none;
        }
      }

    }

    .scroll-bar {
      margin-left: 20px;

      label {
        display: flex;
        align-items: center;
        cursor: pointer;
      }

      .checkbox {
        margin-right: 6px;

        .iconfont {
          display: block;
          font-size: 12px;
        }
      }

      span.text {
        font-size: 12px;
      }
    }
  }


  @media screen and (max-width:1100px) {
    .preview-box {
      // left: 0;
      transform-origin: center 0;
      transform: translate(-50%) scale(0.9);
    }
  }

  @media screen and (max-width:1000px) {
    .preview-box {
      transform: translate(-50%) scale(0.8);
    }
  }

  @media screen and (max-width:900px) {
    .preview-box {
      transform: translate(-50%) scale(0.7);
    }
  }

  @media screen and (max-width:800px) {
    .preview-box {
      transform: translate(-50%) scale(0.6);
    }
  }

  @media screen and (max-width:700px) {
    .preview-box {
      transform: translate(-50%) scale(0.5);
    }
  }

  @media screen and (max-width:600px) {
    .preview-box {
      transform: translate(-50%) scale(0.4);
    }
  }
}
</style>
