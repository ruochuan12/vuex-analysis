// Credits: borrowed code from fcomb/redux-logger
// 深拷贝
import { deepCopy } from '../util'

export default function createLogger ({
  // 默认收缩
  collapsed = true,
  filter = (mutation, stateBefore, stateAfter) => true,
  transformer = state => state,
  mutationTransformer = mut => mut,
  logger = console
} = {}) {
  return store => {
    let prevState = deepCopy(store.state)

    store.subscribe((mutation, state) => {
      if (typeof logger === 'undefined') {
        return
      }
      // 深拷贝
      const nextState = deepCopy(state)

      if (filter(mutation, prevState, nextState)) {
        // 
        const time = new Date()
        // 格式化时分秒毫秒
        const formattedTime = ` @ ${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}.${pad(time.getMilliseconds(), 3)}`
        // 格式化mutation
        const formattedMutation = mutationTransformer(mutation)
        // mutation  mutation类型和时分秒组合
        const message = `mutation ${mutation.type}${formattedTime}`
        const startMessage = collapsed
          ? logger.groupCollapsed
          : logger.group

        // render
        try {
          startMessage.call(logger, message)
        } catch (e) {
          console.log(message)
        }

        logger.log('%c prev state', 'color: #9E9E9E; font-weight: bold', transformer(prevState))
        logger.log('%c mutation', 'color: #03A9F4; font-weight: bold', formattedMutation)
        logger.log('%c next state', 'color: #4CAF50; font-weight: bold', transformer(nextState))

        try {
          logger.groupEnd()
        } catch (e) {
          logger.log('—— log end ——')
        }
      }

      prevState = nextState
    })
  }
}

// 重复函数
function repeat (str, times) {
  return (new Array(times + 1)).join(str)
}

// 填充
function pad (num, maxLength) {
  return repeat('0', maxLength - num.toString().length) + num
}
