import viteReact from '@vitejs/plugin-react';
import * as devalue from 'devalue';

function optionsPlugin({
  include,
  exclude,
  experimentalReactChildren = false,
  experimentalDisableStreaming = false,
}) {
  const virtualModule = 'astro:react:opts';
  const virtualModuleId = `\0${virtualModule}`;

  return {
    name: '@astrojs/react:opts',
    resolveId: {
      filter: {
        id: new RegExp(`^${virtualModule}$`),
      },
      handler() {
        return virtualModuleId;
      },
    },
    load: {
      filter: {
        id: new RegExp(`^${virtualModuleId}$`),
      },
      handler() {
        const opts = {
          include,
          exclude,
          experimentalReactChildren,
          experimentalDisableStreaming,
        };

        return {
          code: `export default ${devalue.uneval(opts)}`,
        };
      },
    },
  };
}

function configEnvironmentPlugin(reactConfig) {
  return {
    name: '@astrojs/react:environment',
    configEnvironment(environmentName, options) {
      const finalOptions = {
        resolve: {
          dedupe: ['react', 'react-dom'],
        },
        optimizeDeps: {},
      };

      if (
        environmentName === 'client' ||
        ((environmentName === 'ssr' || environmentName === 'prerender') &&
          options.optimizeDeps?.noDiscovery === false)
      ) {
        finalOptions.optimizeDeps.include = [
          'react',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react-dom',
        ];
        finalOptions.optimizeDeps.exclude = [reactConfig.server];

        if (environmentName === 'ssr' || environmentName === 'prerender') {
          finalOptions.optimizeDeps.include.push('react-dom/server');
        }

        if (environmentName === 'client') {
          finalOptions.optimizeDeps.include.push('react-dom/client', reactConfig.client);
        }
      }

      return finalOptions;
    },
  };
}

function getViteConfiguration(
  {
    include,
    exclude,
    babel,
    experimentalReactChildren,
    experimentalDisableStreaming,
  } = {},
  reactConfig,
) {
  return {
    plugins: [
      viteReact({ include, exclude, babel }),
      optionsPlugin({
        include,
        exclude,
        experimentalReactChildren: Boolean(experimentalReactChildren),
        experimentalDisableStreaming: Boolean(experimentalDisableStreaming),
      }),
      configEnvironmentPlugin(reactConfig),
    ],
  };
}

export default function astroReactClean({
  include,
  exclude,
  babel,
  experimentalReactChildren,
  experimentalDisableStreaming,
} = {}) {
  const reactConfig = {
    client: '@astrojs/react/client.js',
    server: '@astrojs/react/server.js',
  };

  return {
    name: '@astrojs/react-clean',
    hooks: {
      'astro:config:setup': ({ addRenderer, updateConfig }) => {
        addRenderer({
          name: '@astrojs/react',
          clientEntrypoint: reactConfig.client,
          serverEntrypoint: reactConfig.server,
        });

        updateConfig({
          vite: getViteConfiguration(
            {
              include,
              exclude,
              babel,
              experimentalReactChildren,
              experimentalDisableStreaming,
            },
            reactConfig,
          ),
        });
      },
    },
  };
}
