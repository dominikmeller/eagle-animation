import React, { Component } from 'react'
import { observer } from 'mobx-react';

import { DEFAULT_PATH } from './config'
import Animator from './components/views/Animator'
import Home from './components/views/Home'

import {
    App as ObservableAppStore,
    Project as ObservableProjectStore,
    Projects as ObservableProjectsStore,
    Animator as ObservableAnimatorStore,
    Device as ObservableDeviceStore
} from './store'

@observer
class App extends Component {
    render() {
        return (
            <div>
                {ObservableAppStore.data.view === 'welcome-screen' &&
                    <Home onInit={() => {
                        ObservableProjectsStore.loadProjectsList(DEFAULT_PATH)
                    }}
                        onLoad={(path) => {
                            ObservableProjectStore.load(path);
                            ObservableAppStore.setAppView('animator')
                        }}
                        onOpen={() => {
                            ObservableProjectStore.prompt().then((path) => {
                                if (path) {
                                    ObservableProjectStore.load(path)
                                    ObservableAppStore.setAppView('animator')
                                }
                            });
                        }}
                        onCreate={(name) => {
                            ObservableProjectStore.create(DEFAULT_PATH, name);
                            ObservableAppStore.setAppView('animator')
                        }}
                        onRename={(path, name) => {
                            ObservableProjectsStore.rename(path, name);
                        }}
                        projects={ObservableProjectsStore.data.data}
                    />
                }
                {ObservableAppStore.data.view === 'animator' &&
                    <Animator
                        project={ObservableProjectStore.data.data || false}
                        animator={ObservableAnimatorStore.data}
                        device={ObservableDeviceStore.data}
                        onInit={(dom) => {
                            ObservableDeviceStore.load(dom)
                        }}
                        onParameterChange={(name, value) => { ObservableAnimatorStore.setParameter(name, value) }}
                        onTakePicture={() => {

                        }}
                    />
                }
            </div>
        );
    }
}


export default App